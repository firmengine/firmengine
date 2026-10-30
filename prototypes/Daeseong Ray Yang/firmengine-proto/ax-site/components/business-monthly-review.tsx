"use client";

import {useEffect,useMemo,useState,type FormEvent} from "react";
import type {CaseCommand} from "@/lib/case-command-contract";
import type {BusinessNetReview} from "@/lib/business-net-reconciliation";

type CommandDraft=Omit<CaseCommand,"commandId"|"payloadVersion"|"expectedRevision"|"expectedStateFingerprint">;
type MonthRow={month:string;sourceGrossWon:string|null;sumRawCostLinesWon:string|null;
 revenueGrossFacts:string[];costLineFacts:string[];gaps:string[];legalNetApproved:false};
type MonthView={caseRevision:number;expectedMonths:number;months:MonthRow[];incompleteSourceCoverage:boolean};
type RegistrationRow={sourceRecordId:string;registrationFactId:string;businessIdObserved:string|null;verifiedSource:boolean};
type IdentityView={registrationRows:RegistrationRow[];businessSourceRows:{
 sourceRecordId:string;family:string;amountFactIds:string[];ownerNameObserved:string|null;
 registrationFactId:string|null;ownerEvidenceVerified:boolean}[];automaticIdentityApproval:false};
type ReviewStatus={caseRevision:number;officialPolicyApproved:boolean;policyRuleId:string|null;
 approvedCurrent:number;receipts:{id:string;month:string;incomeId:string;status:string;current:boolean;
 proposedBy:string;reviewer:string|null}[]};
type MoneySourceRow={factId:string;amountWon:string|null;role:string;sourceDocumentIds:string[];sourcePages:number[];verifiedAndAcceptedSource:boolean};
type SourcesView={rows:MoneySourceRow[];total:number;nextOffset:number|null;caseRevision:number};
type Loaded={months:MonthView;identity:IdentityView;status:ReviewStatus;sourceRows:MoneySourceRow[]};
async function readJson<T>(url:string):Promise<T>{
 const r=await fetch(url,{cache:"no-store",credentials:"same-origin"});
 if(!r.ok)throw new Error("사업소득 검토 원문 조회 오류 ("+r.status+")");
 return await r.json() as T;
}
export default function BusinessMonthlyReview({caseId,revision,roles,busy,reviews,onCommand}:{
 caseId:string;revision:number;roles:string[];busy:boolean;
 reviews:readonly BusinessNetReview[]|undefined;
 onCommand:(draft:CommandDraft)=>void|Promise<void>
}){
 const [data,setData]=useState<Loaded|null>(null),[error,setError]=useState("");
 const [month,setMonth]=useState(""),[registration,setRegistration]=useState("");
 const [gross,setGross]=useState(""),[costs,setCosts]=useState<string[]>([]),[reason,setReason]=useState("");
 const [approvalReason,setApprovalReason]=useState<Record<string,string>>({});
 const [fetching,setFetching]=useState(false);
 useEffect(()=>{
  let active=true;setData(null);setFetching(true);setError("");
  const root="/api/cases/"+encodeURIComponent(caseId)+"/data?view=";
  Promise.all([
   readJson<MonthView>(root+"business_monthly_workbench"),
   readJson<IdentityView>(root+"business_identity_crosswalk"),
   readJson<ReviewStatus>(root+"business_net_review_status")
  ]).then(async([months,identity,status])=>{
   if([months.caseRevision,status.caseRevision].some(x=>x!==revision))throw Error("사건 판본이 조회 중 변경되었습니다. 새로고침하세요.");
   const rows:MoneySourceRow[]=[];
   let offset=0;
   for(let page=0;page<20;page++){
    const result=await readJson<SourcesView>(root+"business_source_audit&limit=50&offset="+offset);
    if(result.caseRevision!==revision)throw Error("사건 판본이 조회 중 변경되었습니다. 새로고침하세요.");
    rows.push(...result.rows);
    if(result.nextOffset===null){if(active)setData({months,identity,status,sourceRows:rows});return;}
    offset=result.nextOffset;
   }
   throw Error("출처 목록이 너무 많아 일부 행만 보였습니다. 불완전한 상태에서는 승인할 수 없습니다.");
  }).catch(e=>{if(active){setData(null);setError(e instanceof Error?e.message:"검토 데이터를 확인하세요.");}})
   .finally(()=>{if(active)setFetching(false);});
  return ()=>{active=false;};
 },[caseId,revision]);
 const selected=useMemo(()=>data?.months.months.find(r=>r.month===month)??null,[data,month]);
 const byId=useMemo(()=>new Map((data?.sourceRows??[]).map(row=>[row.factId,row])),[data]);
 const validSources=selected&&selected.revenueGrossFacts.length===1&&
   selected.costLineFacts.length>0&&selected.costLineFacts.every(id=>byId.get(id)?.verifiedAndAcceptedSource);
 const staff=roles.includes("case_editor"),lawyer=staff&&roles.includes("lawyer_review");
 const submitted=(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  if(!data?.status.officialPolicyApproved||!validSources||!registration||!gross||!costs.length||reason.trim().length<15){
   setError("공식 기준·원문 매출·경비·등록사업자·검토사유를 확인하세요.");return;
  }
  if(!selected?.revenueGrossFacts.includes(gross)||costs.some(id=>!selected.costLineFacts.includes(id))){
   setError("선택한 원문 행이 최신 월별 원장과 일치하지 않습니다.");return;
  }
  setError("");
  void onCommand({commandType:"business.net.propose",target:{},
   patch:{businessRegistrationFactId:registration,grossFactId:gross,costFactIds:costs,month},
   reason:reason.trim()});
 };
 const money=(v:string|null)=>v===null?"확인 필요":(/^\-?\d+$/.test(v)?BigInt(v).toLocaleString("ko-KR")+"원":v);
 const sourceLabel=(id:string)=>{
  const f=byId.get(id);
  return f?money(f.amountWon)+" · "+f.sourceDocumentIds.join(",")+" "+f.sourcePages.join(",")+"쪽":id;
 };
 return <section className="panel" aria-label="사업소득 월별 근거 검토">
  <div className="panel-heading"><div className="panel-title"><h2>사업소득 월별 원문·법률 검토</h2></div></div>
  <div className="workflow-panel-body" style={{display:"grid",gap:14}}>
   <p className="workflow-muted">원문 매출·경비 차액은 법률상 인정 소득이 아닙니다. 공식 기준과 동일사업자·원문 기간을 담당자가 대조하고 다른 변호사가 별도로 확정합니다. 모든 승인은 현재 원문/기준 판본과 연결됩니다.</p>
   {error&&<p role="alert" className="workflow-caution">{error}</p>}
   {fetching&&<p className="workflow-muted">현재 원문과 월별 계산 근거를 조회 중입니다.</p>}
   {data&&<>
    <div className="workflow-state-row"><span>공식 기준: {data.status.officialPolicyApproved?"검토된 기준 존재":"승인된 기준 없음 · 소득 승인 차단"}</span>
     <span>대상 기간: {data.months.expectedMonths}개월</span><span>현재 변호사 검토값: {data.status.approvedCurrent}건</span></div>
    <div style={{maxHeight:200,overflowY:"auto",display:"grid",gap:5}}>
      {data.months.months.map(row=><div key={row.month} style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:11}}>
       <strong>{row.month}</strong><span>매출 {money(row.sourceGrossWon)}</span><span>경비 {money(row.sumRawCostLinesWon)}</span>
       <span style={{color:row.gaps.length?"#946c45":"#49664b"}}>{row.gaps.length?"검토 항목 "+row.gaps.length+"개":"원문 수치 확인"}</span>
      </div>)}
    </div>
    {staff&&<form onSubmit={submitted} style={{display:"grid",gap:9}}>
      <strong style={{fontSize:12}}>담당자 원문 대조 제안</strong>
      <label>대상 월<select required value={month} onChange={e=>{setMonth(e.target.value);setGross("");setCosts([]);}}>
       <option value="">검토할 월 선택</option>{data.months.months.map(x=><option key={x.month} value={x.month}>{x.month} · 매출후보 {x.revenueGrossFacts.length} · 경비행 {x.costLineFacts.length}</option>)}
      </select></label>
      <label>등록사업자 원문<select required value={registration} onChange={e=>setRegistration(e.target.value)}>
       <option value="">원문 사업자등록 확인</option>
       {data.identity.registrationRows.filter(x=>x.verifiedSource).map(r=><option key={r.registrationFactId} value={r.registrationFactId}>{r.businessIdObserved} · {r.sourceRecordId}</option>)}
      </select></label>
      {selected&&<div style={{display:"grid",gap:7}}>
       <label>총매출 원문<select required value={gross} onChange={e=>setGross(e.target.value)}>
        <option value="">검증된 원문 총매출 선택</option>
        {selected.revenueGrossFacts.map(id=><option key={id} value={id}>{sourceLabel(id)}</option>)}
       </select></label>
       <strong style={{fontSize:11}}>개별 경비 원문(중복 합계 금지)</strong>
       {selected.costLineFacts.map(id=><label key={id} style={{fontSize:11}}>
        <input type="checkbox" checked={costs.includes(id)} onChange={e=>setCosts(rows=>e.target.checked?[...rows,id]:rows.filter(x=>x!==id))}/>
        {" "+sourceLabel(id)}
       </label>)}
       <p className="workflow-caution">사업자등록번호가 존재하는 것만으로 서로 다른 서류가 동일 사업자임을 증명하지 않습니다. 근거를 확인한 후 제안하세요.</p>
      </div>}
      <label>원문·사업자·필요경비 검토 사유<textarea required minLength={15} maxLength={4000} value={reason} onChange={e=>setReason(e.target.value)} rows={3}/></label>
      <button className="button button-outline" disabled={busy||!data.status.officialPolicyApproved||!validSources||!gross||!costs.length} type="submit">담당자 검토 제안 저장</button>
    </form>}
    <div style={{display:"grid",gap:8}}>
     <strong style={{fontSize:12}}>법률 검토 이력</strong>
     {!(reviews??[]).length&&<p className="workflow-muted">현재 제안·승인 이력이 없습니다.</p>}
     {(reviews??[]).map(review=><div className="workflow-card" key={review.id}>
       <strong>{review.month} · {review.status==="approved"?"변호사 검토 승인":review.status==="proposed"?"변호사 검토 대기":"만료"}</strong>
       <p>매출 {money(review.grossWon)} / 경비 {money(review.costWon)} / 순소득 {money(review.netWon)}</p>
       {review.status==="approved"&&!data.status.receipts.some(x=>x.id===review.id&&x.current)&&<p className="workflow-caution">원문·기준정보 변경으로 승인 효력 재검토 필요</p>}
       {lawyer&&review.status==="proposed"&&<form style={{display:"grid",gap:7,marginTop:8}} onSubmit={e=>{
        e.preventDefault();const why=approvalReason[review.id]?.trim()??"";
        if(why.length<15){setError("변호사 검토에는 상세한 법률·회계 판단 근거가 필요합니다.");return;}
        if(!window.confirm("매출·경비 원문, 동일사업자와 공식 법원 기준을 직접 검토하고 승인하시겠습니까?"))return;
        setError("");void onCommand({commandType:"business.net.adopt",target:{reviewId:review.id},patch:{},reason:why});
       }}><label>변호사 독립 검토 및 비용 인정 근거<textarea required minLength={15} maxLength={4000}
        value={approvalReason[review.id]??""} onChange={e=>setApprovalReason(prev=>({...prev,[review.id]:e.target.value}))} rows={3}/></label>
        <button type="submit" className="button button-outline" disabled={busy||!data.status.officialPolicyApproved}>변호사 검토 승인</button>
       </form>}
      </div>)}
    </div>
   </>}
  </div>
 </section>;
}
