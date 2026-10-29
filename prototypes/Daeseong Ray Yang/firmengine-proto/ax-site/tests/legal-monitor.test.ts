import test from "node:test";
import assert from "node:assert/strict";
import { canonicalMonitorUrl, isOfficialMonitorUrl, normalizeMonitorText, runLegalMonitor, type MonitorObservation, type MonitorRuleProjection, type MonitorSource } from "../lib/legal-monitor-core.ts";
import { LEGAL_MONITOR_SOURCES } from "../lib/legal-monitor-sources.ts";
import catalog from "../lib/legal-catalog.json" with {type:"json"};
import exceptions from "../lib/legal-exceptions.json" with {type:"json"};
import templates from "../public/templates/catalog.json" with {type:"json"};

const at="2026-10-29T01:00:00.000Z";
const source:MonitorSource={id:"law-611",title:"채무자 회생 및 파산에 관한 법률 제611조",agent:"legislation",url:"https://www.law.go.kr/LSW/lsSideInfoP.do?joNo=0611",kind:"law",officialDomains:["law.go.kr"]};
const rule:MonitorRuleProjection={id:"term-default",title:"기본 변제기간",category:"statute",sourceIds:["law-611"],sourceUrls:[source.url]};
const page=(months=36,counter=10)=>`<!doctype html><html><head><title>개인회생 변제기간</title></head><body><header>사이트 공통 메뉴</header><main><h1>채무자 회생 및 파산에 관한 법률 제611조</h1><p>개인회생 변제기간의 기준 값은 ${months}개월이며 적용 범위는 부칙을 확인한다.</p><p>시행 2026. 10. 1. 공포일 2026. 9. 20.</p><table><tr><th>조회</th><td>${counter}</td></tr></table></main><script>const clock=${counter};</script></body></html>`;
const html=(body:string)=>new Response(body,{headers:{"content-type":"text/html; charset=utf-8"}});
function fetchBody(body:string):typeof fetch{return (async()=>html(body)) as typeof fetch;}
const prior=(observations:MonitorObservation[])=>Object.fromEntries(observations.map(o=>[o.sourceId,o]));

test("monitor seeds cover every existing legal citation, exception source and official blank form original",()=>{
  for(const row of catalog.source_catalog)assert.ok(LEGAL_MONITOR_SOURCES.some(s=>canonicalMonitorUrl(s.url)===canonicalMonitorUrl(row.url)),row.id);
  for(const row of exceptions.sources)assert.ok(LEGAL_MONITOR_SOURCES.some(s=>canonicalMonitorUrl(s.url)===canonicalMonitorUrl(row.url)),row.id);
  for(const form of templates.forms)for(const original of form.originals)assert.ok(LEGAL_MONITOR_SOURCES.some(s=>canonicalMonitorUrl(s.url)===canonicalMonitorUrl(original.url)),form.code);
  assert.equal(new Set(LEGAL_MONITOR_SOURCES.map(s=>s.id)).size,LEGAL_MONITOR_SOURCES.length);
  assert.ok(LEGAL_MONITOR_SOURCES.every(s=>isOfficialMonitorUrl(s.url,s.officialDomains)));
  assert.ok(LEGAL_MONITOR_SOURCES.some(s=>s.discoverLinks&&s.agent==="court_documents"));
  assert.ok(LEGAL_MONITOR_SOURCES.some(s=>s.kind==="bill_index"));
});

test("first collection creates a baseline, then ignores counters but detects a legal value change with deterministic alert identity",async()=>{
  const first=await runLegalMonitor({sources:[source],rules:[rule],previous:{},now:at,fetcher:fetchBody(page())});
  assert.equal(first.status,"complete");assert.equal(first.observations.length,1);assert.equal(first.candidates.length,0);
  const unchanged=await runLegalMonitor({sources:[source],rules:[rule],previous:prior(first.observations),now:at,fetcher:fetchBody(page(36,9999))});
  assert.equal(unchanged.candidates.length,0);assert.equal(unchanged.observations[0].sha256,first.observations[0].sha256);
  assert.notEqual(unchanged.observations[0].rawSha256,first.observations[0].rawSha256);
  const args={sources:[source],rules:[rule],previous:prior(first.observations),now:at,fetcher:fetchBody(page(48))};
  const changed=await runLegalMonitor(args),same=await runLegalMonitor(args);
  assert.equal(changed.candidates.length,1);assert.equal(changed.candidates[0].id,same.candidates[0].id);
  assert.equal(changed.candidates[0].status,"effective");assert.equal(changed.candidates[0].effectiveDate,"2026-10-01");
  assert.deepEqual(changed.candidates[0].affectedRuleIds,["term-default"]);assert.equal(changed.candidates[0].requiresHumanReview,true);
  assert.equal(changed.candidates[0].previousHash,first.observations[0].sha256);
  assert.equal(changed.candidates[0].currentHash,changed.observations[0].sha256);
  const afterSaved=await runLegalMonitor({...args,previous:prior(changed.observations)});assert.equal(afterSaved.candidates.length,0);
});

test("same-URL PDF byte changes are detected without pretending that document semantics were verified",async()=>{
  const notice:MonitorSource={...source,id:"form-notice",agent:"court_documents",kind:"court_notice",url:"https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?seqnum=1",officialDomains:["scourt.go.kr"]};
  const attachment="https://file.scourt.go.kr/AttachDownload?path=004&file=official.pdf";
  const body=`<html><title>개인회생 자료제출목록 공고</title><body><p>개인회생 자료제출목록의 공식 첨부파일을 다음과 같이 안내하니 확인하시기 바랍니다.</p><a href="${attachment}">필수제출목록.pdf</a></body></html>`;
  const mock=(revision:number)=>(async(input:RequestInfo|URL)=>String(input).includes("AttachDownload")?new Response(`%PDF-1.7 fixture revision ${revision}`,{headers:{"content-type":"application/pdf"}}):html(body)) as typeof fetch;
  const first=await runLegalMonitor({sources:[notice],rules:[{...rule,sourceIds:[notice.id]}],previous:{},now:at,fetcher:mock(1)});
  const second=await runLegalMonitor({sources:[notice],rules:[{...rule,sourceIds:[notice.id]}],previous:prior(first.observations),now:at,fetcher:mock(2)});
  assert.equal(second.observations[0].sha256,first.observations[0].sha256);
  assert.equal(second.candidates.length,1);assert.equal(second.candidates[0].kind,"attachment_changed");
  assert.ok(second.candidates[0].evidence.some(v=>v.includes("의미 변경은 아직 검토하지")));
  assert.ok(second.candidates[0].sourceUrls.includes(canonicalMonitorUrl(attachment)));
});

test("a replaced attachment URL with an unchanged label is a meaningful notice change",async()=>{
  const notice:MonitorSource={...source,id:"notice",agent:"court_documents",url:"https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?seqnum=1",kind:"court_notice",officialDomains:["scourt.go.kr"]};
  const mock=(file:string)=>(async(input:RequestInfo|URL)=>String(input).includes("AttachDownload")?new Response("%PDF-1.7 same body",{headers:{"content-type":"application/pdf"}}):html(`<html><title>개인회생 안내</title><p>개인회생 신청에 필요한 공식 제출자료 목록을 첨부하오니 변경 여부를 확인하시기 바랍니다.</p><a href="https://file.scourt.go.kr/AttachDownload?file=${file}">자료제출목록</a></html>`)) as typeof fetch;
  const first=await runLegalMonitor({sources:[notice],rules:[],previous:{},now:at,fetcher:mock("old.pdf")});
  const second=await runLegalMonitor({sources:[notice],rules:[],previous:prior(first.observations),now:at,fetcher:mock("new.pdf")});
  assert.equal(second.candidates[0]?.kind,"source_changed");
});

test("blocked/failed retrieval leaves the previously verified baseline unchanged and never creates a change alert",async()=>{
  const baseline=await runLegalMonitor({sources:[source],rules:[rule],previous:{},now:at,fetcher:fetchBody(page())});
  const previous=prior(baseline.observations),before=JSON.stringify(previous);
  for(const fetcher of [fetchBody("<html><body>The request / response that are contrary to the Web firewall security policies have been blocked.</body></html>"),((async()=>new Response("not found",{status:404})) as typeof fetch)]){
    const result=await runLegalMonitor({sources:[source],rules:[rule],previous,now:at,fetcher});
    assert.equal(result.status,"partial");assert.equal(result.observations.length,0);assert.equal(result.candidates.length,0);
    assert.ok(["blocked","failed"].includes(result.sourceHealth[0].status));assert.equal(JSON.stringify(previous),before);
  }
});

test("fetching is restricted to exact official-domain boundaries, including every redirect",async()=>{
  for(const url of ["https://law.go.kr.evil.example/a","http://www.law.go.kr/a","https://user:pass@law.go.kr/a","https://127.0.0.1/a","https://scourt.go.kr:8443/a"])assert.equal(isOfficialMonitorUrl(url),false,url);
  assert.equal(isOfficialMonitorUrl("https://file.scourt.go.kr/AttachDownload?file=one.pdf"),true);
  assert.equal(isOfficialMonitorUrl("https://scourt.go.kr/a",["law.go.kr"]),false);
  let calls=0;const fetcher=(async()=>{calls++;return new Response(null,{status:302,headers:{location:"https://evil.example/leak"}});}) as typeof fetch;
  const result=await runLegalMonitor({sources:[source],rules:[],previous:{},now:at,fetcher});
  assert.equal(calls,1);assert.equal(result.observations.length,0);assert.equal(result.sourceHealth[0].status,"blocked");
});

test("proposed bills stay proposed even when their text mentions an existing law's effective date",async()=>{
  const bill:MonitorSource={...source,id:"bill",url:"https://opinion.lawmaking.go.kr/gcom/nsmLmSts/out/2217169/detailRP",kind:"bill_index",officialDomains:["lawmaking.go.kr"]};
  const first=await runLegalMonitor({sources:[bill],rules:[],previous:{},now:at,fetcher:fetchBody(page(36))});
  const second=await runLegalMonitor({sources:[bill],rules:[],previous:prior(first.observations),now:at,fetcher:fetchBody(page(24))});
  assert.equal(second.candidates[0].status,"proposed");assert.equal(second.candidates[0].requiresHumanReview,true);
});

test("future law commencement remains scheduled_effective and conflicting dates remain unknown",async()=>{
  const first=await runLegalMonitor({sources:[source],rules:[],previous:{},now:at,fetcher:fetchBody(page())});
  const future=await runLegalMonitor({sources:[source],rules:[],previous:prior(first.observations),now:at,fetcher:fetchBody(page(24).replace("시행 2026. 10. 1.","시행 2027. 1. 1."))});
  assert.equal(future.candidates[0].status,"scheduled_effective");
  const ambiguous=await runLegalMonitor({sources:[source],rules:[],previous:prior(first.observations),now:at,fetcher:fetchBody(page(24)+"<p>부칙 시행 2027. 1. 1.</p>")});
  assert.equal(ambiguous.candidates[0].effectiveDate,null);
});

test("optional DRF credentials are never guessed, persisted in observation URLs, or included in health output",async()=>{
  const api:MonitorSource={...source,id:"drf",url:"https://www.law.go.kr/DRF/lawSearch.do?target=eflaw",kind:"law_api",api:{target:"eflaw",query:"채무자 회생 및 파산에 관한 법률"}};
  let calls=0,url="";const fetcher=(async(input:RequestInfo|URL)=>{calls++;url=String(input);return new Response(JSON.stringify({LawSearch:{totalCnt:1,law:[{법령ID:"009930",법령명한글:"채무자 회생 및 파산에 관한 법률",시행일자:"20261002",법령상세링크:"/DRF/lawService.do?OC=synthetic-not-a-secret&ID=009930"}]}}),{headers:{"content-type":"application/json"}});}) as typeof fetch;
  const disabled=await runLegalMonitor({sources:[api],rules:[],previous:{},now:at,fetcher});assert.equal(calls,0);assert.equal(disabled.sourceHealth[0].status,"disabled");
  const result=await runLegalMonitor({sources:[api],rules:[],previous:{},now:at,fetcher,lawOpenDataOc:"synthetic-not-a-secret"});
  assert.equal(calls,1);assert.equal(new URL(url).searchParams.get("nw"),"2,3");
  assert.equal(new URL(result.observations[0].url).searchParams.has("OC"),false);assert.ok(!JSON.stringify(result).includes("synthetic-not-a-secret"));
});

test("bounded runs return a continuation cursor instead of reporting unvisited sources as checked",async()=>{
  const sources=[1,2,3].map(n=>({...source,id:`source-${n}`,url:`https://www.law.go.kr/LSW/lsSideInfoP.do?joNo=${n}`}));
  const first=await runLegalMonitor({sources,rules:[],previous:{},now:at,fetcher:fetchBody(page()),limits:{maxSources:1}});
  assert.equal(first.processedSources,1);assert.equal(first.totalSources,3);assert.equal(first.nextCursor,1);assert.equal(first.status,"partial");
  const second=await runLegalMonitor({sources,rules:[],previous:prior(first.observations),cursor:first.nextCursor!,now:at,fetcher:fetchBody(page()),limits:{maxSources:2}});
  assert.equal(second.nextCursor,null);assert.equal(second.processedSources,2);assert.deepEqual(second.observations.map(o=>o.sourceId),["source-2","source-3"]);
});

test("body-size limits abort oversized responses without replacing a baseline",async()=>{
  const result=await runLegalMonitor({sources:[source],rules:[],previous:{},now:at,fetcher:fetchBody(page()),limits:{maxBytesPerResponse:80}});
  assert.equal(result.status,"partial");assert.equal(result.observations.length,0);assert.ok(result.sourceHealth[0].message.includes("RESPONSE_TOO_LARGE"));
});

test("a failed attachment retains its previous known hash without creating a false amendment",async()=>{
  const s:MonitorSource={...source,id:"court",agent:"court_documents",kind:"court_notice",url:"https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?seqnum=1",officialDomains:["scourt.go.kr"]};
  const body='<html><title>개인회생 자료제출 안내</title><p>개인회생 사건에서 필요한 제출서류 자료의 공식 목록을 첨부합니다. 최신 적용 여부를 확인하십시오.</p><a href="https://file.scourt.go.kr/AttachDownload?file=a.pdf">필수서류</a></html>';
  const mock=(bad:boolean)=>(async(input:RequestInfo|URL)=>String(input).includes("AttachDownload")?bad?new Response("error",{status:503}):new Response("%PDF fixture",{headers:{"content-type":"application/pdf"}}):html(body)) as typeof fetch;
  const baseline=await runLegalMonitor({sources:[s],rules:[],previous:{},now:at,fetcher:mock(false)});
  const result=await runLegalMonitor({sources:[s],rules:[],previous:prior(baseline.observations),now:at,fetcher:mock(true)});
  assert.equal(result.observations[0].attachments[0].sha256,baseline.observations[0].attachments[0].sha256);assert.equal(result.candidates.length,0);assert.equal(result.sourceHealth[0].status,"partial");
});

test("official-domain search candidates are fetched and verified, with a separate first-discovery baseline",async()=>{
  const discovered={url:"https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?seqnum=777",title:"새 개인회생 실무준칙 공고",agent:"court_documents" as const};
  const args={sources:[],rules:[],previous:{},now:at,fetcher:fetchBody(page()),discover:async()=>[discovered,{...discovered,url:"https://scourt.go.kr.evil.example/a"}]};
  const first=await runLegalMonitor(args);assert.equal(first.observations.length,1);assert.equal(first.candidates.length,0);assert.equal(first.discoveryUrls.length,1);
  const second=await runLegalMonitor({...args,discoveryBaselineUrls:[]});assert.equal(second.candidates.length,1);assert.equal(second.candidates[0].status,"newly_discovered");
});

test("AI analysis cannot invent affected rule IDs or activate a candidate",async()=>{
  const baseline=await runLegalMonitor({sources:[source],rules:[rule],previous:{},now:at,fetcher:fetchBody(page())});
  const result=await runLegalMonitor({sources:[source],rules:[rule],previous:prior(baseline.observations),now:at,fetcher:fetchBody(page(24)),analyze:async()=>({summary:"검토 의견",affectedRuleIds:["term-default","invented-id"],evidence:["원문 비교 필요"]})});
  assert.deepEqual(result.candidates[0].analysis?.affectedRuleIds,["term-default"]);assert.equal(result.candidates[0].requiresHumanReview,true);assert.equal(result.analysisStatus,"complete");
});

test("unresponsive discovery callbacks are bounded and receive a cancellation signal",async()=>{
  let signal:AbortSignal|undefined;
  const result=await runLegalMonitor({sources:[],rules:[],previous:{},now:at,limits:{maxRunMs:15},discover:async context=>{signal=context.signal;return await new Promise(()=>{});}});
  assert.equal(result.discoveryStatus,"failed");assert.equal(result.status,"partial");assert.equal(signal?.aborted,true);
});

test("text normalization preserves money, clause references and legal dates",()=>{
  const normalized=normalizeMonitorText('<p>제611조 36개월, 1000000000원, 시행 2026. 10. 1.</p><p>조회수: 100</p>');
  assert.ok(normalized.includes("제611조 36개월, 1000000000원, 시행 2026. 10. 1."));assert.ok(!normalized.includes("조회수"));
});

test("bounded attachment scans rotate unread files instead of starving documents later in the list",async()=>{
  const s:MonitorSource={...source,id:"rotation",agent:"court_documents",url:"https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?seqnum=20",kind:"court_notice",officialDomains:["scourt.go.kr"]};
  const body='<html><title>개인회생 제출서류 변경 안내</title><p>개인회생 사건의 필수 서류 목록을 게시합니다. 각각의 공식 첨부자료를 확인하세요.</p>'+[1,2,3].map(n=>`<a href="https://file.scourt.go.kr/AttachDownload?file=${n}.pdf">개인회생 서식 ${n}</a>`).join("")+"</html>";
  const fetched:string[]=[];const fetcher=(async(input:RequestInfo|URL)=>{const url=String(input);if(url.includes("AttachDownload")){fetched.push(new URL(url).searchParams.get("file")!);return new Response("%PDF fixture",{headers:{"content-type":"application/pdf"}});}return html(body);}) as typeof fetch;
  const first=await runLegalMonitor({sources:[s],rules:[],previous:{},now:at,fetcher,limits:{maxAttachmentsPerSource:1}});
  const second=await runLegalMonitor({sources:[s],rules:[],previous:prior(first.observations),now:"2026-10-29T02:00:00.000Z",fetcher,limits:{maxAttachmentsPerSource:1}});
  await runLegalMonitor({sources:[s],rules:[],previous:prior(second.observations),now:"2026-10-29T03:00:00.000Z",fetcher,limits:{maxAttachmentsPerSource:1}});
  assert.deepEqual(fetched,["1.pdf","2.pdf","3.pdf"]);
});

test("an index baseline distinguishes changed link inventory and newly posted detail without view-count churn",async()=>{
  const s:MonitorSource={...source,id:"index",agent:"court_documents",url:"https://slb.scourt.go.kr/dcboard/new/DcNewsListAction.work?gubun=41",kind:"court_notice",officialDomains:["scourt.go.kr"],discoverLinks:true,keywords:["개인회생"]};
  const mock=(newRow:boolean,views:number)=>(async(input:RequestInfo|URL)=>String(input).includes("DcNewsListAction")?html(`<html><title>개인회생 게시판</title><table><tr><td><a href="/dcboard/new/DcNewsViewAction.work?seqnum=1">개인회생 기존 제출서류</a></td><td>${views}</td></tr>${newRow?'<tr><td><a href="/dcboard/new/DcNewsViewAction.work?seqnum=2">개인회생 변경 서식 공고</a></td><td>1</td></tr>':""}</table></html>`):html(page())) as typeof fetch;
  const first=await runLegalMonitor({sources:[s],rules:[],previous:{},now:at,fetcher:mock(false,1)});
  const noisy=await runLegalMonitor({sources:[s],rules:[],previous:prior(first.observations),now:at,fetcher:mock(false,999)});assert.equal(noisy.candidates.length,0);
  const changed=await runLegalMonitor({sources:[s],rules:[],previous:prior(first.observations),now:at,fetcher:mock(true,999)});
  assert.ok(changed.candidates.some(c=>c.kind==="source_changed"));assert.ok(changed.candidates.some(c=>c.kind==="new_publication"));
});

test("a mislabeled error response is not accepted as a new official PDF",async()=>{
  const s:MonitorSource={...source,id:"badpdf",agent:"court_documents",url:"https://file.scourt.go.kr/AttachDownload?file=form.pdf",kind:"attachment",officialDomains:["scourt.go.kr"]};
  const fetcher=(async()=>new Response("Temporary server unavailable",{headers:{"content-type":"application/pdf"}})) as typeof fetch;
  const result=await runLegalMonitor({sources:[s],rules:[],previous:{},now:at,fetcher});
  assert.equal(result.observations.length,0);assert.ok(result.sourceHealth[0].message.includes("INVALID_PDF_RESPONSE"));
});

test("failed discovered URLs remain pending and do not suppress a later verified discovery alert",async()=>{
  const discovered={url:"https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?seqnum=880",title:"개인회생 변경 공고",agent:"court_documents" as const};
  const first=await runLegalMonitor({sources:[],rules:[],previous:{},now:at,discoveryBaselineUrls:[],discover:async()=>[discovered],fetcher:(async()=>new Response("unavailable",{status:503})) as typeof fetch});
  assert.equal(first.discoveryUrls.length,0);assert.equal(first.pendingDiscoveries.length,1);assert.equal(first.observations.length,0);
  let requests=0;const sameDay=await runLegalMonitor({sources:[],rules:[],previous:{},now:"2026-10-29T03:00:00.000Z",pendingDiscoveries:first.pendingDiscoveries,discoveryBaselineUrls:[],fetcher:(async()=>{requests++;return html(page());}) as typeof fetch});
  assert.equal(requests,0);assert.equal(sameDay.pendingDiscoveries.length,1);
  const recovered=await runLegalMonitor({sources:[],rules:[],previous:{},now:"2026-10-30T01:00:00.000Z",pendingDiscoveries:first.pendingDiscoveries,discoveryBaselineUrls:[],fetcher:fetchBody(page())});
  assert.equal(recovered.pendingDiscoveries.length,0);assert.equal(recovered.discoveryUrls.length,1);assert.equal(recovered.candidates[0].kind,"new_publication");assert.equal(recovered.candidates[0].status,"newly_discovered");
});

test("a cold-start search result stays baseline-only after a delayed successful retrieval",async()=>{
  const discovered={url:"https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?seqnum=881",title:"기존 개인회생 공고",agent:"court_documents" as const};
  const first=await runLegalMonitor({sources:[],rules:[],previous:{},now:at,discover:async()=>[discovered],fetcher:(async()=>new Response("unavailable",{status:503})) as typeof fetch});
  assert.equal(first.pendingDiscoveries[0].baselineOnly,true);
  const recovered=await runLegalMonitor({sources:[],rules:[],previous:{},now:"2026-10-30T01:00:00.000Z",pendingDiscoveries:first.pendingDiscoveries,discoveryBaselineUrls:[],fetcher:fetchBody(page())});
  assert.equal(recovered.observations.length,1);assert.equal(recovered.candidates.length,0);
});

test("search runs before pinned-source work and its overflow resumes without another search",async()=>{
  const discoveries=[1,2].map(n=>({url:`https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?seqnum=${900+n}`,title:`개인회생 공고 ${n}`,agent:"court_documents" as const}));
  const order:string[]=[];let searches=0;const fetcher=(async(input:RequestInfo|URL)=>{order.push(String(input));return html(page());}) as typeof fetch;
  const first=await runLegalMonitor({sources:[source],rules:[],previous:{},now:at,discover:async()=>{searches++;order.push("search");return discoveries;},discoveryBaselineUrls:[],fetcher,limits:{maxRequests:1}});
  assert.equal(order[0],"search");assert.ok(order[1].includes("seqnum=901"));assert.equal(first.nextCursor,0);assert.equal(first.pendingDiscoveries.length,1);
  const second=await runLegalMonitor({sources:[source],rules:[],previous:prior(first.observations),now:at,cursor:first.nextCursor!,pendingDiscoveries:first.pendingDiscoveries,discoveryBaselineUrls:first.discoveryUrls,fetcher});
  assert.equal(searches,1);assert.equal(second.pendingDiscoveries.length,0);assert.equal(second.nextCursor,null);assert.equal(second.observations.length,2);
});

test("failed pending search items do not starve other discoveries in same-day continuation",async()=>{
  const urls=[1,2].map(n=>`https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?seqnum=${950+n}`);
  const pending=[{url:urls[0],title:"실패 공고",agent:"court_documents" as const,lastAttemptAt:at,retryAfter:"2026-10-29T15:00:00.000Z"},{url:urls[1],title:"다른 개인회생 공고",agent:"court_documents" as const}];
  const fetched:string[]=[];const result=await runLegalMonitor({sources:[],rules:[],previous:{},now:at,pendingDiscoveries:pending,discoveryBaselineUrls:[],fetcher:(async(input:RequestInfo|URL)=>{fetched.push(String(input));return html(page());}) as typeof fetch});
  assert.equal(fetched.length,1);assert.ok(fetched[0].includes("seqnum=952"));assert.equal(result.pendingDiscoveries.length,1);assert.equal(result.observations.length,1);
});

test("failed first attachments record attempts and allow later files to be checked",async()=>{
  const s:MonitorSource={...source,id:"failed-attachment-rotation",agent:"court_documents",url:"https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?seqnum=25",kind:"court_notice",officialDomains:["scourt.go.kr"]};
  const body='<html><title>개인회생 제출서류 변경 안내</title><p>개인회생 사건의 필수 서류 목록을 게시합니다. 각각의 공식 첨부자료를 확인하세요.</p>'+[1,2,3].map(n=>`<a href="https://file.scourt.go.kr/AttachDownload?file=${n}.pdf">개인회생 서식 ${n}</a>`).join("")+"</html>";
  const fetched:string[]=[];const fetcher=(async(input:RequestInfo|URL)=>{const url=String(input);if(url.includes("AttachDownload")){const file=new URL(url).searchParams.get("file")!;fetched.push(file);return file==="1.pdf"?new Response("WAF",{status:403}):new Response("%PDF fixture",{headers:{"content-type":"application/pdf"}});}return html(body);}) as typeof fetch;
  const first=await runLegalMonitor({sources:[s],rules:[],previous:{},now:at,fetcher,limits:{maxAttachmentsPerSource:1}});
  const second=await runLegalMonitor({sources:[s],rules:[],previous:prior(first.observations),now:"2026-10-29T02:00:00.000Z",fetcher,limits:{maxAttachmentsPerSource:1}});
  const third=await runLegalMonitor({sources:[s],rules:[],previous:prior(second.observations),now:"2026-10-29T03:00:00.000Z",fetcher,limits:{maxAttachmentsPerSource:1}});
  assert.deepEqual(fetched,["1.pdf","2.pdf","3.pdf"]);const failed=third.observations[0].attachments.find(a=>a.url.includes("1.pdf"))!;assert.equal(failed.lastAttemptAt,at);assert.equal(failed.status,"failed");assert.equal(failed.sha256,undefined);
});

test("failed first detail pages use source-health attempt history to avoid starving later notices",async()=>{
  const s:MonitorSource={...source,id:"detail-rotation",agent:"court_documents",url:"https://slb.scourt.go.kr/dcboard/new/DcNewsListAction.work?gubun=41",kind:"court_notice",officialDomains:["scourt.go.kr"],discoverLinks:true,keywords:["개인회생"]};
  const body='<html><title>개인회생 자료 공고 목록</title>'+[1,2,3].map(n=>`<a href="/dcboard/new/DcNewsViewAction.work?seqnum=${n}">개인회생 공고 ${n}</a>`).join("")+"</html>";
  const fetched:string[]=[];const fetcher=(async(input:RequestInfo|URL)=>{const url=String(input);if(url.includes("DcNewsViewAction")){const id=new URL(url).searchParams.get("seqnum")!;fetched.push(id);return id==="1"?new Response("blocked",{status:403}):html(page());}return html(body);}) as typeof fetch;
  const first=await runLegalMonitor({sources:[s],rules:[],previous:{},now:at,fetcher,limits:{maxDiscoveredPerSource:1}});
  const second=await runLegalMonitor({sources:[s],rules:[],previous:prior(first.observations),previousSourceHealth:first.sourceHealth,now:"2026-10-29T02:00:00.000Z",fetcher,limits:{maxDiscoveredPerSource:1}});
  const health=[...new Map([...first.sourceHealth,...second.sourceHealth].map(h=>[h.sourceId,h])).values()];
  await runLegalMonitor({sources:[s],rules:[],previous:prior([...first.observations,...second.observations]),previousSourceHealth:health,now:"2026-10-29T03:00:00.000Z",fetcher,limits:{maxDiscoveredPerSource:1}});
  assert.deepEqual(fetched,["1","2","3"]);
});

test("an exhausted pinned cursor can drain pending discoveries without restarting the completed sweep",async()=>{
  const fetched:string[]=[];const result=await runLegalMonitor({sources:[source],rules:[],previous:{},now:at,cursor:1,pendingDiscoveries:[{url:"https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?seqnum=999",title:"개인회생 공고",agent:"court_documents"}],discoveryBaselineUrls:[],fetcher:(async(input:RequestInfo|URL)=>{fetched.push(String(input));return html(page());}) as typeof fetch});
  assert.equal(result.processedSources,0);assert.equal(result.nextCursor,null);assert.equal(fetched.length,1);assert.ok(fetched[0].includes("seqnum=999"));
});

test("a pinned index found by search still follows detail links before URL dedup skips the pinned loop",async()=>{
  const s:MonitorSource={...source,id:"index-via-search",agent:"court_documents",url:"https://slb.scourt.go.kr/dcboard/new/DcNewsListAction.work?gubun=41",kind:"court_notice",officialDomains:["scourt.go.kr"],discoverLinks:true,keywords:["개인회생"]};
  const index='<html><title>개인회생 공고 목록</title><a href="/dcboard/new/DcNewsViewAction.work?seqnum=112">개인회생 변경 서식 안내</a></html>';
  const fetched:string[]=[];const result=await runLegalMonitor({sources:[s],rules:[],previous:{},now:at,discover:async()=>[{url:s.url,title:s.title,agent:"court_documents"}],fetcher:(async(input:RequestInfo|URL)=>{const url=String(input);fetched.push(url);return html(url.includes("DcNewsListAction")?index:page());}) as typeof fetch});
  assert.equal(result.observations.length,2);assert.equal(fetched.length,2);assert.ok(fetched[1].includes("seqnum=112"));assert.equal(result.nextCursor,null);
});
