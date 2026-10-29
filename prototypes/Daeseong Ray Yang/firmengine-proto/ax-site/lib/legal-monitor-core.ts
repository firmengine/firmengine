/** Official-source monitoring only. This module has no case-store or rule-activation writes. */
export type MonitorAgent = "legislation" | "court_documents";
export type MonitorSourceKind = "law" | "administrative_rule" | "practice_rule" | "court_notice" | "court_forms" | "attachment" | "bill_index" | "legislation_index" | "law_api" | "case_law";
export interface MonitorRuleProjection { id:string; title:string; category:string; sourceIds:string[]; sourceUrls:string[]; keywords?:string[]; }
export interface MonitorSource {
  id:string; title:string; agent:MonitorAgent; url:string; kind:MonitorSourceKind; officialDomains:string[];
  sourceAliases?:string[]; keywords?:string[]; court?:string; enabled?:boolean; disabledReason?:string;
  api?:{target:"eflaw"|"admrul"|"lsHstInf"|"lsJoHstInf";query?:string;lawId?:string};
  discoverLinks?:boolean;
}
export interface MonitorAttachment { url:string; title:string; sha256?:string; fetchedAt?:string; lastAttemptAt?:string; retryAfter?:string; status:"verified"|"failed"|"deferred"; error?:string; }
export interface MonitorObservation {
  sourceId:string; url:string; sha256:string; rawSha256:string; fetchedAt:string; contentType:string;
  etag?:string; lastModified?:string; title:string; textExcerpt:string;
  attachments:MonitorAttachment[]; discoveredLinks:string[];
  publishedDate?:string|null; effectiveDate?:string|null; promulgatedDate?:string|null;
}
export type MonitorCandidateStatus = "proposed"|"promulgated"|"scheduled_effective"|"effective"|"practice_notice"|"form_notice"|"unconfirmed_change"|"newly_discovered";
export interface MonitorCandidate {
  id:string; agent:MonitorAgent; sourceId:string; kind:"source_changed"|"attachment_changed"|"new_publication";
  status:MonitorCandidateStatus; title:string; summary:string; affectedRuleIds:string[];
  previousHash:string|null; currentHash:string; effectiveDate:string|null; promulgatedDate:string|null;
  sourceUrls:string[]; evidence:string[]; requiresHumanReview:true;
  analysis?:{summary:string;evidence:string[];affectedRuleIds:string[]};
}
export interface MonitorSourceHealth { sourceId:string; status:"ok"|"partial"|"blocked"|"failed"|"disabled"|"deferred"; message:string; checkedAt:string; }
export interface MonitorDiscovery { url:string; title:string; agent:MonitorAgent; sourceId?:string; baselineOnly?:boolean; discoveredAt?:string; lastAttemptAt?:string; retryAfter?:string; }
export interface MonitorAnalysis { summary:string; affectedRuleIds?:string[]; evidence?:string[]; }
export interface MonitorLimits {
  maxSources:number; maxRequests:number; maxBytesPerResponse:number; maxTotalBytes:number; requestTimeoutMs:number; maxRunMs:number;
  maxAttachmentsPerSource:number; maxDiscoveredPerSource:number; maxDiscoveryResults:number; maxAnalyses:number;
}
export interface MonitorRunOptions {
  sources:readonly MonitorSource[]; rules:readonly MonitorRuleProjection[]; previous:Record<string,MonitorObservation>;
  agent?:MonitorAgent|"all"; cursor?:number; now?:string; fetcher?:typeof fetch; lawOpenDataOc?:string;
  discover?:(context:{agent:MonitorAgent|"all";sources:readonly MonitorSource[];rules:readonly MonitorRuleProjection[];since:string|null;allowedDomains:readonly string[];signal:AbortSignal})=>Promise<MonitorDiscovery[]>;
  analyze?:(context:{candidate:MonitorCandidate;source:MonitorSource;observation:MonitorObservation;previous:MonitorObservation|null;rules:readonly MonitorRuleProjection[];signal:AbortSignal})=>Promise<MonitorAnalysis>;
  discoveryBaselineUrls?:string[]; pendingDiscoveries?:MonitorDiscovery[]; previousSourceHealth?:MonitorSourceHealth[]; limits?:Partial<MonitorLimits>;
}
export interface MonitorRunResult {
  observations:MonitorObservation[]; candidates:MonitorCandidate[]; sourceHealth:MonitorSourceHealth[];
  status:"complete"|"partial"; nextCursor:number|null; processedSources:number; totalSources:number; requests:number; bytes:number;
  discoveryStatus:"not_requested"|"complete"|"failed"|"deferred"; analysisStatus:"not_requested"|"complete"|"partial";
  discoveryUrls:string[]; pendingDiscoveries:MonitorDiscovery[];
}
export const OFFICIAL_MONITOR_DOMAINS = ["law.go.kr","scourt.go.kr","assembly.go.kr","lawmaking.go.kr","mohw.go.kr","moj.go.kr","gov.kr"] as const;
export const DEFAULT_MONITOR_LIMITS:MonitorLimits = {maxSources:12,maxRequests:36,maxBytesPerResponse:4_194_304,maxTotalBytes:20_971_520,requestTimeoutMs:8_000,maxRunMs:50_000,maxAttachmentsPerSource:2,maxDiscoveredPerSource:2,maxDiscoveryResults:6,maxAnalyses:2};
const encoder=new TextEncoder();
const HASH=/^[a-f0-9]{64}$/;
const koreanDay=(value:string)=>new Date(Date.parse(value)+9*60*60*1000).toISOString().slice(0,10);
const nextKoreanDay=(value:string)=>new Date(Date.parse(`${koreanDay(value)}T00:00:00+09:00`)+86_400_000).toISOString();
const domainMatches=(host:string,domain:string)=>host===domain||host.endsWith(`.${domain}`);
/** Both the global official-domain boundary and the particular source boundary must pass. */
export function isOfficialMonitorUrl(value:string,domains:readonly string[]=OFFICIAL_MONITOR_DOMAINS):boolean {
  try {const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&(!u.port||u.port==="443")&&OFFICIAL_MONITOR_DOMAINS.some(d=>domainMatches(u.hostname,d))&&domains.some(d=>OFFICIAL_MONITOR_DOMAINS.some(root=>domainMatches(d,root))&&domainMatches(u.hostname,d));}catch{return false;}
}
export function canonicalMonitorUrl(value:string):string {
  const u=new URL(value);u.hash="";
  for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid|OC$|api[_-]?key$|key$|token$)/i.test(key)||["pageIndex","searchWord","searchOption","scode_kname"].includes(key))u.searchParams.delete(key);
  u.searchParams.sort();return u.href;
}
const sha=async(value:string|Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",typeof value==="string"?encoder.encode(value):new Uint8Array(value)))).map(x=>x.toString(16).padStart(2,"0")).join("");
function unique<T>(values:T[]):T[]{return [...new Set(values)];}
function decodeEntities(s:string){return s.replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[a-f0-9]+|[0-9]+);/gi,m=>{const named:Record<string,string>={"&amp;":"&","&quot;":"\"","&apos;":"'","&lt;":"<","&gt;":">","&nbsp;":" "};if(named[m.toLowerCase()])return named[m.toLowerCase()];const n=m.toLowerCase().startsWith("&#x")?parseInt(m.slice(3,-1),16):parseInt(m.slice(2,-1),10);return Number.isFinite(n)&&n>=0&&n<=0x10ffff?String.fromCodePoint(n):" ";});}
/** Ignore counters and presentation code, while retaining clause numbers, legal dates and amounts. */
export function normalizeMonitorText(html:string):string {
  return decodeEntities(html.replace(/<!--[\s\S]*?-->/g," ").replace(/<(script|style|noscript|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi," ")
    .replace(/<t[hd]\b[^>]*>\s*(?:조회수?|접속자수)\s*<\/t[hd]>\s*<td\b[^>]*>[\s\S]*?<\/td>/gi," ")
    .replace(/<(input|select|button)\b[^>]*>[\s\S]*?<\/\1\s*>/gi," ").replace(/<input\b[^>]*>/gi," ").replace(/<[^>]+>/g," "))
    .replace(/(?:조회수?|접속자수)\s*[:：|]?\s*[\d,]+/g," ").replace(/(?:현재시간|서버시간|접속시간)\s*[:：]?\s*\d{4}[-./]\d{1,2}[-./]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?/g," ").replace(/\s+/g," ").trim();
}
function stableJson(value:unknown):string {if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(stableJson).join(",")}]`;return `{${Object.keys(value as object).sort().map(k=>`${JSON.stringify(k)}:${stableJson((value as Record<string,unknown>)[k])}`).join(",")}}`;}
function blockedContent(text:string):boolean {return /web\s*firewall|access\s*denied|request\s*(?:\/|and)\s*response.*blocked|captcha|비정상적인\s*접근|접근이?\s*(?:차단|제한)|서비스\s*접근\s*제한|요청하신\s*페이지를\s*찾을\s*수\s*없|인증키.*(?:확인|오류|유효하지)|유효하지\s*않은\s*(?:인증|키)|API\s*(?:key|인증).*(?:invalid|오류)/i.test(text);}
function isAttachmentUrl(url:string){return /\.(pdf|hwp|hwpx|docx?|xlsx?|zip)(?:[?#]|$)|AttachDownload|flDownload\.do/i.test(url);}
function isContentLink(url:string){return isAttachmentUrl(url)||/NewsViewAction|MinViewAction|LegislationView|ls(?:Info|SideInfo)|admRulInfo|precInfo|lsLinkCommonInfo|lawService\.do|\/detail(?:RP)?(?:\?|$)|\/(?:법령|행정규칙)\//i.test(decodeURIComponent(url));}
interface ExtractedLink {url:string;title:string;attachment:boolean;}
function extractLinks(html:string,base:string,source:MonitorSource):ExtractedLink[]{
  const found:ExtractedLink[]=[];
  const add=(raw:string,title:string)=>{try{const url=new URL(decodeEntities(raw),base).href;if(isOfficialMonitorUrl(url,source.officialDomains)&&isContentLink(url)){const canonical=canonicalMonitorUrl(url);if(!found.some(l=>l.url===canonical))found.push({url:canonical,title:normalizeMonitorText(title)||source.title,attachment:isAttachmentUrl(url)});}}catch{}};
  for(const m of html.matchAll(/<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a\s*>/gi))add(m[3],m[5]);
  // Some court attachments are literal official URLs inside click handlers. Never execute page code.
  for(const m of html.matchAll(/https?:\/\/[^\s"'<>]+(?:AttachDownload|flDownload\.do)[^\s"'<>]*/gi))add(m[0],source.title);
  return found;
}
const relevant=(title:string,source:MonitorSource)=>!source.keywords?.length||source.keywords.some(k=>title.includes(k));
function dateFromLabel(text:string,label:string):string|null {
  const re=new RegExp(`(?:${label})\\s*[:：\\[\\(]?\\s*(20\\d{2})\\s*[.년/-]\\s*(\\d{1,2})\\s*[.월/-]\\s*(\\d{1,2})`,'g');
  const dates=unique([...text.matchAll(re)].map(m=>`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`).filter(d=>{const time=Date.parse(d);return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===d;}));return dates.length===1?dates[0]:null;
}
function metadata(text:string){return {publishedDate:dateFromLabel(text,"작성일|등록일|게시일|공고일"),effectiveDate:dateFromLabel(text,"시행일자|시행일|시행"),promulgatedDate:dateFromLabel(text,"공포일자|공포일|공포")};}
function candidateStatus(source:MonitorSource,observation:MonitorObservation,now:string):MonitorCandidateStatus {
  if(source.kind==="bill_index"||source.url.includes("lawmaking.go.kr")||source.url.includes("assembly.go.kr"))return "proposed";
  if(source.agent==="court_documents")return source.kind==="court_forms"||source.kind==="attachment"?"form_notice":"practice_notice";
  if(observation.effectiveDate)return observation.effectiveDate>now.slice(0,10)?"scheduled_effective":"effective";
  return observation.promulgatedDate?"promulgated":"unconfirmed_change";
}
function affectedRules(source:MonitorSource,observation:MonitorObservation,rules:readonly MonitorRuleProjection[]):string[]{
  const ids=new Set([source.id,...source.sourceAliases??[]]),urls=new Set([source.url,observation.url,...observation.attachments.map(a=>a.url)].map(u=>canonicalMonitorUrl(u))),text=`${observation.title} ${observation.textExcerpt}`;
  return rules.filter(r=>r.sourceIds.some(id=>ids.has(id))||r.sourceUrls.some(u=>{try{return urls.has(canonicalMonitorUrl(u));}catch{return false;}})||(r.keywords??[]).some(k=>k.length>=3&&text.includes(k))).map(r=>r.id).sort();
}
class FetchIssue extends Error {readonly code:string;readonly partial:boolean;constructor(code:string,partial=false){super(code);this.code=code;this.partial=partial;}}
interface Budget {requests:number;bytes:number;started:number;limits:MonitorLimits;fetcher:typeof fetch;}
async function boundedCallback<T>(budget:Budget,run:(signal:AbortSignal)=>Promise<T>):Promise<T>{
  const remaining=budget.limits.maxRunMs-(Date.now()-budget.started);if(remaining<=0)throw new FetchIssue("RUN_BUDGET_EXHAUSTED",true);
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([run(controller.signal),new Promise<T>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new FetchIssue("RUN_BUDGET_EXHAUSTED",true));},remaining);})]);}finally{if(timer!==undefined)clearTimeout(timer);}
}
async function readLimited(response:Response,budget:Budget):Promise<Uint8Array>{
  const declared=Number(response.headers.get("content-length")??0);
  if(declared>budget.limits.maxBytesPerResponse||declared+budget.bytes>budget.limits.maxTotalBytes)throw new FetchIssue("RESPONSE_TOO_LARGE",true);
  if(!response.body)throw new FetchIssue("EMPTY_RESPONSE");
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;budget.bytes+=value.byteLength;if(size>budget.limits.maxBytesPerResponse||budget.bytes>budget.limits.maxTotalBytes){await reader.cancel();throw new FetchIssue("RESPONSE_TOO_LARGE",true);}chunks.push(value);}}
  finally{reader.releaseLock();}
  if(!size)throw new FetchIssue("EMPTY_RESPONSE");const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
async function fetchOfficial(url:string,source:MonitorSource,budget:Budget):Promise<{bytes:Uint8Array;url:string;contentType:string;etag?:string;lastModified?:string}>{
  let current=url;
  for(let redirects=0;redirects<=3;redirects++){
    if(!isOfficialMonitorUrl(current,source.officialDomains))throw new FetchIssue("UNTRUSTED_DOMAIN");
    const remaining=budget.limits.maxRunMs-(Date.now()-budget.started);
    if(budget.requests>=budget.limits.maxRequests||remaining<=0)throw new FetchIssue("RUN_BUDGET_EXHAUSTED",true);
    budget.requests++;
    const response=await budget.fetcher(current,{redirect:"manual",signal:AbortSignal.timeout(Math.max(1,Math.min(remaining,budget.limits.requestTimeoutMs))),headers:{Accept:"text/html,application/json,application/pdf,*/*;q=0.5"}});
    if([301,302,303,307,308].includes(response.status)){const location=response.headers.get("location");await response.body?.cancel();if(!location)throw new FetchIssue("REDIRECT_WITHOUT_LOCATION");current=new URL(location,current).href;continue;}
    if(!response.ok){await response.body?.cancel();throw new FetchIssue(`HTTP_${response.status}`);}
    if(response.url&&!isOfficialMonitorUrl(response.url,source.officialDomains)){await response.body?.cancel();throw new FetchIssue("UNTRUSTED_REDIRECT");}
    return {bytes:await readLimited(response,budget),url:canonicalMonitorUrl(current),contentType:response.headers.get("content-type")??"application/octet-stream",etag:response.headers.get("etag")??undefined,lastModified:response.headers.get("last-modified")??undefined};
  }
  throw new FetchIssue("TOO_MANY_REDIRECTS");
}
function decodeBody(bytes:Uint8Array,contentType:string):string {const header=contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];const prefix=new TextDecoder().decode(bytes.subarray(0,2048));const charset=header??prefix.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]??"utf-8";try{return new TextDecoder(charset).decode(bytes);}catch{throw new FetchIssue("UNSUPPORTED_ENCODING");}}
function redactApiCredential(text:string,credential?:string):string {let result=text.replace(/([?&](?:OC|api[_-]?key|token)=)[^&\s"'<>]+/gi,"$1[REDACTED]");if(credential){result=result.split(credential).join("[REDACTED]");result=result.split(encodeURIComponent(credential)).join("[REDACTED]");}return result;}
function apiUrl(source:MonitorSource,oc:string,now:string):string {
  const u=new URL(source.url);u.searchParams.set("OC",oc);u.searchParams.set("type","JSON");u.searchParams.set("target",source.api!.target);u.searchParams.set("display","100");
  if(source.api!.query)u.searchParams.set("query",source.api!.query);if(source.api!.lawId)u.searchParams.set(source.api!.target==="eflaw"?"LID":"ID",source.api!.lawId);
  if(source.api!.target==="eflaw")u.searchParams.set("nw","2,3");
  if(source.api!.target==="lsHstInf"||source.api!.target==="lsJoHstInf")u.searchParams.set("regDt",new Date(Date.parse(now)-86_400_000).toISOString().slice(0,10).replaceAll("-",""));
  return u.href;
}
function binaryBody(bytes:Uint8Array,contentType:string){return /application\/(?:pdf|octet-stream|x-hwp|vnd\.|zip)|image\//i.test(contentType)&&!/^\s*[<{[]/.test(new TextDecoder().decode(bytes.subarray(0,50)))||bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46||bytes[0]===0xd0&&bytes[1]===0xcf||bytes[0]===0x50&&bytes[1]===0x4b;}
function checkPdfResponse(bytes:Uint8Array,contentType:string,url:string){if(/application\/pdf/i.test(contentType)||/\.pdf(?:[?&#]|$)/i.test(url)){if(!new TextDecoder().decode(bytes.subarray(0,1024)).includes("%PDF"))throw new FetchIssue("INVALID_PDF_RESPONSE");}}
function issueCode(error:unknown){return error instanceof FetchIssue?error.code:error instanceof Error&&/abort|timeout/i.test(error.name)?"FETCH_TIMEOUT":"FETCH_FAILED";}
function boundedLimits(values:Partial<MonitorLimits>|undefined):MonitorLimits {
  const result={...DEFAULT_MONITOR_LIMITS};for(const key of Object.keys(result) as (keyof MonitorLimits)[]){const n=values?.[key];if(typeof n==="number"&&Number.isFinite(n)&&n>=0)result[key]=Math.floor(n);}
  result.maxSources=Math.min(result.maxSources,100);result.maxRequests=Math.min(result.maxRequests,100);result.maxBytesPerResponse=Math.min(result.maxBytesPerResponse,8_388_608);result.maxTotalBytes=Math.min(result.maxTotalBytes,41_943_040);result.maxRunMs=Math.min(result.maxRunMs,90_000);result.requestTimeoutMs=Math.min(result.requestTimeoutMs,15_000);result.maxAttachmentsPerSource=Math.min(result.maxAttachmentsPerSource,8);result.maxDiscoveredPerSource=Math.min(result.maxDiscoveredPerSource,8);result.maxDiscoveryResults=Math.min(result.maxDiscoveryResults,20);result.maxAnalyses=Math.min(result.maxAnalyses,8);return result;
}

/** Returns new successful observations only; callers must retain stored baselines on failed/deferred sources. */
export async function runLegalMonitor(options:MonitorRunOptions):Promise<MonitorRunResult>{
  const now=options.now??new Date().toISOString();if(!Number.isFinite(Date.parse(now)))throw new Error("INVALID_MONITOR_TIME");
  const sources=options.sources.filter(s=>!options.agent||options.agent==="all"||s.agent===options.agent),limits=boundedLimits(options.limits);
  const cursor=Number.isInteger(options.cursor)&&options.cursor!>=0&&options.cursor!<=sources.length?options.cursor!:0;
  const budget:Budget={requests:0,bytes:0,started:Date.now(),limits,fetcher:options.fetcher??fetch};
  const observations:MonitorObservation[]=[],candidates:MonitorCandidate[]=[],sourceHealth:MonitorSourceHealth[]=[];
  const observationSources=new Map<string,MonitorSource>(),seenUrls=new Set<string>(),successfulUrls=new Set<string>();let partial=false,processedSources=0,analyses=0;
  const priorHealth=new Map((options.previousSourceHealth??[]).map(row=>[row.sourceId,row]));
  let discoveryStatus:MonitorRunResult["discoveryStatus"]=options.discover?"deferred":"not_requested",analysisStatus:MonitorRunResult["analysisStatus"]=options.analyze?"complete":"not_requested";
  const discoveryUrls:string[]=[],pendingDiscoveries:MonitorDiscovery[]=[];
  const health=(source:MonitorSource,status:MonitorSourceHealth["status"],message:string)=>sourceHealth.push({sourceId:source.id,status,message,checkedAt:now});
  const makeCandidate=async(source:MonitorSource,observation:MonitorObservation,kind:MonitorCandidate["kind"],oldHash:string|null,newHash:string,url=observation.url):Promise<MonitorCandidate>=>({
    id:`lmc_${(await sha(`${source.agent}|${source.id}|${kind}|${oldHash??"new"}|${newHash}|${url}`)).slice(0,32)}`,agent:source.agent,sourceId:source.id,kind,
    status:kind==="new_publication"?source.kind==="bill_index"?"proposed":"newly_discovered":candidateStatus(source,observation,now),title:observation.title,
    summary:kind==="attachment_changed"?"동일한 공식 첨부파일 URL의 내용 해시가 변경되었습니다. 서식·기재항목·시행일을 원문과 대조해 검토해야 합니다.":kind==="new_publication"?"기존 감시 목록에 없던 공식 자료를 발견했습니다. 신규 개정인지 기존 자료의 뒤늦은 발견인지 원문 날짜와 적용범위를 확인해야 합니다.":"공식 원문의 의미 있는 텍스트 또는 관련 문서 링크가 저장 기준본과 달라졌습니다. 개정 여부와 적용범위 검토가 필요합니다.",
    affectedRuleIds:affectedRules(source,observation,options.rules),previousHash:oldHash,currentHash:newHash,effectiveDate:observation.effectiveDate??null,promulgatedDate:observation.promulgatedDate??null,
    sourceUrls:unique([observation.url,url]),evidence:[`retrieved_at=${now}`,`previous_sha256=${oldHash??"unseen"}`,`current_sha256=${newHash}`,`official_source=${url}`,kind==="attachment_changed"?"첨부 바이트 변경을 확인했으며 조문·서식 의미 변경은 아직 검토하지 않았습니다.":`원문 발췌: ${observation.textExcerpt.slice(0,700)}`],requiresHumanReview:true,
  });
  const observe=async(source:MonitorSource,discoveredNew=false,followLinks=true):Promise<"observed"|"skipped"|"failed"|"deferred">=>{
    if(source.enabled===false){health(source,"disabled",source.disabledReason??"SOURCE_DISABLED");return "skipped";}
    if(source.api&&!options.lawOpenDataOc){health(source,"disabled","LAW_OPEN_DATA_OC_NOT_CONFIGURED: 공식 공개 페이지 및 도메인 검색 경로를 사용합니다.");return "skipped";}
    if(!isOfficialMonitorUrl(source.url,source.officialDomains)){health(source,"blocked","UNTRUSTED_DOMAIN");partial=true;return "failed";}
    const canonical=canonicalMonitorUrl(source.url);if(seenUrls.has(canonical))return successfulUrls.has(canonical)?"observed":"failed";seenUrls.add(canonical);
    const previous=options.previous[source.id]??Object.values(options.previous).filter(o=>{try{return canonicalMonitorUrl(o.url)===canonical;}catch{return false;}}).sort((a,b)=>b.fetchedAt.localeCompare(a.fetchedAt))[0];
    try{
      const fetched=await fetchOfficial(source.api?apiUrl(source,options.lawOpenDataOc!,now):source.url,source,budget),rawSha256=await sha(fetched.bytes),binary=!source.api&&binaryBody(fetched.bytes,fetched.contentType);
      let title=source.title,text="",meaningful="",links:ExtractedLink[]=[];
      if(binary){checkPdfResponse(fetched.bytes,fetched.contentType,fetched.url);meaningful=rawSha256;text="공식 문서의 원본 바이트를 수집했습니다. PDF/HWP 본문 의미와 적용일은 별도 검토가 필요합니다.";}
      else{
        const decoded=redactApiCredential(decodeBody(fetched.bytes,fetched.contentType),options.lawOpenDataOc);if(blockedContent(decoded))throw new FetchIssue("ACCESS_BLOCKED_OR_ERROR_PAGE");
        const replacements=(decoded.match(/\uFFFD/g)??[]).length;if(replacements>Math.max(12,decoded.length/200))throw new FetchIssue("UNREADABLE_ENCODING");
        text=normalizeMonitorText(decoded);if(text.length<(source.discoverLinks?12:40))throw new FetchIssue("EMPTY_OR_INCOMPLETE_CONTENT");
        if(/application\/json/i.test(fetched.contentType)||source.api){let parsed:unknown;try{parsed=JSON.parse(decoded);}catch{throw new FetchIssue("INVALID_JSON_RESPONSE");}meaningful=stableJson(parsed);text=meaningful;}
        else{
          links=extractLinks(decoded,fetched.url,source);title=normalizeMonitorText(decoded.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??source.title)||source.title;
          const relevantLinks=links.filter(l=>relevant(l.title,source));
          if(source.discoverLinks){if(!relevantLinks.length)throw new FetchIssue("NO_RELEVANT_INDEX_LINKS");meaningful=stableJson(relevantLinks.map(l=>({url:l.url,title:l.title})).sort((a,b)=>a.url.localeCompare(b.url)));text=relevantLinks.map(l=>`${l.title} ${l.url}`).join("\n");}
          else meaningful=stableJson({text,attachments:links.filter(l=>l.attachment).map(l=>l.url).sort()});
        }
      }
      // Oldest/unread attachments rotate first. A bounded run must not permanently starve later links.
      const attemptAt=(url:string)=>{const prior=previous?.attachments.find(v=>v.url===url);return prior?.lastAttemptAt??prior?.fetchedAt??"";};
      const attachmentLinks=links.filter(l=>l.attachment&&(!source.discoverLinks||relevant(l.title,source))).sort((a,b)=>attemptAt(a.url).localeCompare(attemptAt(b.url))),attachments:MonitorAttachment[]=[];let sourcePartial=false,attachmentAttempts=0;
      for(let i=0;i<attachmentLinks.length;i++){
        const link=attachmentLinks[i],old=previous?.attachments.find(a=>a.url===link.url);
        if(old?.retryAfter&&old.retryAfter>now){attachments.push({...old,url:link.url,title:link.title});sourcePartial=true;continue;}
        if(attachmentAttempts>=limits.maxAttachmentsPerSource){attachments.push({...old,url:link.url,title:link.title,status:"deferred"});sourcePartial=true;continue;}
        attachmentAttempts++;
        try{const att=await fetchOfficial(link.url,source,budget);checkPdfResponse(att.bytes,att.contentType,link.url);if(!binaryBody(att.bytes,att.contentType)){const body=decodeBody(att.bytes,att.contentType);if(blockedContent(body)||/<html|<!doctype/i.test(body))throw new FetchIssue("ATTACHMENT_ERROR_PAGE");}
          attachments.push({url:link.url,title:link.title,sha256:await sha(att.bytes),fetchedAt:now,lastAttemptAt:now,status:"verified"});}
        catch(error){const deferred=issueCode(error)==="RUN_BUDGET_EXHAUSTED"||Date.now()-budget.started>=limits.maxRunMs;attachments.push({...old,url:link.url,title:link.title,status:deferred?"deferred":"failed",error:issueCode(error),...(deferred?{}:{lastAttemptAt:now,retryAfter:nextKoreanDay(now)})});sourcePartial=true;}
      }
      const observation:MonitorObservation={sourceId:source.id,url:fetched.url,sha256:binary?rawSha256:await sha(meaningful),rawSha256,fetchedAt:now,contentType:fetched.contentType,etag:fetched.etag,lastModified:fetched.lastModified,title,textExcerpt:text.slice(0,16_000),attachments,discoveredLinks:links.filter(l=>relevant(l.title,source)).map(l=>l.url),...(binary?{}:metadata(text))};
      observations.push(observation);observationSources.set(source.id,source);successfulUrls.add(canonical);
      if(previous&&HASH.test(previous.sha256)&&previous.sha256!==observation.sha256)candidates.push(await makeCandidate(source,observation,"source_changed",previous.sha256,observation.sha256));
      else if(!previous&&discoveredNew)candidates.push(await makeCandidate(source,observation,"new_publication",null,observation.sha256));
      for(const attachment of attachments){const old=previous?.attachments.find(a=>a.url===attachment.url);if(attachment.status==="verified"&&attachment.sha256&&old?.sha256&&attachment.sha256!==old.sha256)candidates.push(await makeCandidate(source,observation,"attachment_changed",old.sha256,attachment.sha256,attachment.url));}
      health(source,sourcePartial?"partial":"ok",sourcePartial?"일부 첨부 확인을 완료하지 못했습니다. 기존 해시는 보존했습니다.":previous?"공식 원문 재확인 완료":"기준본 저장 완료; 최초 수집을 개정으로 판정하지 않음");if(sourcePartial)partial=true;
      if(source.discoverLinks&&followLinks){const eligible=await Promise.all(links.filter(l=>relevant(l.title,source)&&!l.attachment).map(async link=>({...link,id:`${source.id}:document:${(await sha(link.url)).slice(0,20)}`})));
        const attemptAt=(id:string)=>priorHealth.get(id)?.checkedAt??options.previous[id]?.fetchedAt??"";
        const children=eligible.filter(child=>{const old=priorHealth.get(child.id);return !(old&&["failed","blocked"].includes(old.status)&&Number.isFinite(Date.parse(old.checkedAt))&&koreanDay(old.checkedAt)===koreanDay(now));}).sort((a,b)=>attemptAt(a.id).localeCompare(attemptAt(b.id))).slice(0,limits.maxDiscoveredPerSource);
        for(const child of children){await observe({...source,id:child.id,url:child.url,title:child.title,kind:source.kind==="bill_index"?"bill_index":source.agent==="legislation"?"law":"court_notice",api:undefined,discoverLinks:false,sourceAliases:unique([source.id,...source.sourceAliases??[]])},!!previous&&!previous.discoveredLinks.includes(child.url),false);}
        if(links.filter(l=>relevant(l.title,source)&&!l.attachment).length>children.length){partial=true;health({...source,id:`${source.id}:discovery`},"partial","관련 상세문서를 순환 확인합니다. 당일 실패한 문서는 다음 날짜에 재확인하며 목록 링크 변경은 별도로 감지합니다.");}}
      return "observed";
    }catch(error){const code=issueCode(error),status=code==="RUN_BUDGET_EXHAUSTED"||Date.now()-budget.started>=limits.maxRunMs?"deferred":/UNTRUSTED|ACCESS_BLOCKED/.test(code)?"blocked":"failed";health(source,status,`${code}: 기존 정상 기준본을 유지합니다.`);partial=true;return status==="deferred"?"deferred":"failed";}
  };
  // Search once when requested, before the pinned sweep consumes its budget. All
  // unverified results survive in a durable queue that can resume without search.
  const queued=new Map<string,MonitorDiscovery>();
  const enqueue=(item:MonitorDiscovery,fromSearch=false)=>{
    if(!item||!isOfficialMonitorUrl(item.url)||!["legislation","court_documents"].includes(item.agent)||options.agent&&options.agent!=="all"&&item.agent!==options.agent)return;
    const url=canonicalMonitorUrl(item.url);if(queued.has(url))return;
    queued.set(url,{url,title:String(item.title??"").slice(0,500),agent:item.agent,...(item.sourceId?{sourceId:item.sourceId}:{}),baselineOnly:item.baselineOnly??(fromSearch&&options.discoveryBaselineUrls===undefined),discoveredAt:item.discoveredAt??now,...(item.lastAttemptAt?{lastAttemptAt:item.lastAttemptAt}:{}),...(item.retryAfter?{retryAfter:item.retryAfter}:{})});
  };
  for(const item of options.pendingDiscoveries??[])enqueue(item);
  if(options.discover&&budget.requests<limits.maxRequests&&Date.now()-budget.started<limits.maxRunMs){
    try{
      const since=Object.values(options.previous).map(o=>o.fetchedAt).filter(v=>Number.isFinite(Date.parse(v))).sort().at(-1)??null;
      const found=await boundedCallback(budget,signal=>options.discover!({agent:options.agent??"all",sources,rules:options.rules,since,allowedDomains:OFFICIAL_MONITOR_DOMAINS,signal}));discoveryStatus="complete";
      for(const item of found)enqueue(item,true);
    }catch{discoveryStatus="failed";partial=true;}
  }else if(options.discover)partial=true;
  let discoveryAttempts=0;
  for(const item of [...queued.values()].sort((a,b)=>(a.lastAttemptAt??"").localeCompare(b.lastAttemptAt??""))){
    if(item.retryAfter&&item.retryAfter>now||discoveryAttempts>=limits.maxDiscoveryResults||budget.requests>=limits.maxRequests||Date.now()-budget.started>=limits.maxRunMs){pendingDiscoveries.push(item);partial=true;continue;}
    discoveryAttempts++;
    const existing=sources.find(source=>canonicalMonitorUrl(source.url)===item.url);
    const id=existing?.id??`web:${item.agent}:${(await sha(item.url)).slice(0,24)}`;
    const foundSource:MonitorSource=existing??{id,title:item.title,url:item.url,agent:item.agent,kind:item.agent==="court_documents"?isAttachmentUrl(item.url)?"attachment":"court_notice":/assembly.go.kr|lawmaking.go.kr/.test(new URL(item.url).hostname)?"bill_index":"law",officialDomains:[...OFFICIAL_MONITOR_DOMAINS],sourceAliases:item.sourceId?[item.sourceId]:[]};
    const outcome=await observe(foundSource,!item.baselineOnly&&!!options.discoveryBaselineUrls&&!options.discoveryBaselineUrls.includes(item.url),!!existing?.discoverLinks);
    if(outcome==="observed")discoveryUrls.push(item.url);
    else {pendingDiscoveries.push({...item,...(outcome==="deferred"?{}:{lastAttemptAt:now,retryAfter:nextKoreanDay(now)})});partial=true;}
  }
  for(let index=cursor;index<sources.length&&processedSources<limits.maxSources;index++){
    if(budget.requests>=limits.maxRequests||Date.now()-budget.started>=limits.maxRunMs){partial=true;break;}
    await observe(sources[index]);processedSources++;
  }
  const next=cursor+processedSources,nextCursor=next<sources.length?next:null;if(nextCursor!==null)partial=true;
  if(options.analyze)for(const candidate of candidates){
    const observation=observations.find(o=>o.sourceId===candidate.sourceId),source=observationSources.get(candidate.sourceId);
    if(!observation||!source||analyses>=limits.maxAnalyses||Date.now()-budget.started>=limits.maxRunMs){analysisStatus="partial";continue;}
    analyses++;
    try{const result=await boundedCallback(budget,signal=>options.analyze!({candidate,source,observation,previous:options.previous[source.id]??null,rules:options.rules.filter(r=>candidate.affectedRuleIds.includes(r.id)),signal}));
      const allowed=new Set(candidate.affectedRuleIds);candidate.analysis={summary:String(result.summary??"").slice(0,4000),evidence:(result.evidence??[]).filter(s=>typeof s==="string").map(s=>s.slice(0,1200)).slice(0,12),affectedRuleIds:(result.affectedRuleIds??[]).filter(id=>allowed.has(id))};
    }catch{analysisStatus="partial";}
  }
  if(analysisStatus==="partial")partial=true;
  return {observations,candidates:[...new Map(candidates.map(c=>[c.id,c])).values()],sourceHealth,status:partial?"partial":"complete",nextCursor,processedSources,totalSources:sources.length,requests:budget.requests,bytes:budget.bytes,discoveryStatus,analysisStatus,discoveryUrls:unique(discoveryUrls),pendingDiscoveries};
}
