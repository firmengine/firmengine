"use client";
import { useState, type FormEvent } from "react";
import type { CaseRequirement } from "@/lib/case-requirements";
import type { SubstitutionView } from "@/lib/document-substitution";

export interface SubstitutionProofCandidate {
  id:string;fieldId:string;subjectId:string;sourcePages:{documentId:string;page:number}[];
}
export default function SubstitutionReviewForm({requirement,state,facts,busy,onReview}:{
 requirement:CaseRequirement;state:SubstitutionView|undefined;facts:readonly SubstitutionProofCandidate[];busy:boolean;
 onReview:(proposal:Record<string,unknown>,basisRefs:string[],reason:string)=>void;
}){
 const [message,setMessage]=useState("");
 if(!requirement.alternatives.length||!requirement.sourceEvidenceFields?.length)return null;
 const handle=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setMessage("");
  const data=new FormData(event.currentTarget);
  const selected=data.getAll("sub_alternatives").map(String);
  if(!selected.length){setMessage("먼저 등록된 갈음 후보를 선택하세요.");return;}
  const proofs=requirement.sourceEvidenceFields!.map((field,i)=>({requiredField:field,factIds:[String(data.get("sub_fact_"+i)??"")].filter(Boolean)}));
  if(proofs.some(p=>!p.factIds.length)){setMessage("원 서류의 모든 증명 항목에 근거 사실을 연결하세요.");return;}
  const periodStart=String(data.get("sub_period_start")??""),periodEnd=String(data.get("sub_period_end")??"");
  const reason=String(data.get("sub_reason")??"").trim();
  if(!periodStart||!periodEnd||periodStart>periodEnd||!reason){setMessage("검토 기간과 갈음 사유를 확인하세요.");return;}
  const basisRefs=[...new Set(proofs.flatMap(p=>p.factIds))];
  onReview({alternativeDocumentTypeIds:selected,proofs,periodStart,periodEnd,
    exceptionReason:String(data.get("sub_exception")??""),
    employerSigned:data.get("sub_signed")==="on"},basisRefs,reason);
 };
 const pending=state?.status!=="inactive_by_substitution";
 return <details className="workflow-details">
  <summary>{pending?"갈음서류 증명항목 검토":"갈음 승인 기록·근거 확인"} · {state?.status==="inactive_by_substitution"?"요청 자동 비활성화":"원본 요청 유지"}</summary>
  <div className="workflow-caution">원본 요청을 삭제하지 않습니다. 등록 후보 + 원본 필수 항목 전체 + 승인된 출처 + 관할 규칙이 일치해야 요청이 숨겨집니다. 미확인·변경 시 자동 복구됩니다.</div>
  {state&&<div className="workflow-muted">
    <p>증명 항목 {state.coveredFields.length}/{state.coveredFields.length+state.missingFields.length} · 연결 자료 {state.supportDocumentIds.length}건</p>
    {state.missingFields.length>0&&<p>아직 미확인: {state.missingFields.join(", ")}</p>}
    {state.reasonCodes.length>0&&<p>확인 사항: {state.reasonCodes.join(" · ")}</p>}
    {state.reviewedBy&&<p>이전 검토자: {state.reviewedBy}</p>}
  </div>}
  <form className="workflow-form" onSubmit={handle}>
   <div className="form-grid">
    <div className="field"><span>갈음 후보 (여러 자료 동시 선택 가능)</span>
      {requirement.alternatives.map(item=><label key={item.id} style={{display:"flex",gap:8,alignItems:"center",padding:"6px 0"}}>
        <input type="checkbox" name="sub_alternatives" value={item.id} disabled={busy}/><span>{item.name}</span></label>)}
    </div>
    {requirement.sourceEvidenceFields.map((field,i)=><label className="field" key={field}>
      <span>원본 증명 항목 {i+1}. {field}</span>
      <select name={"sub_fact_"+i} required defaultValue="" disabled={busy}>
        <option value="" disabled>검증된 원문 근거를 선택하세요</option>
        {facts.map(f=><option key={f.id} value={f.id}>
          {f.fieldId} · {f.sourcePages.map(p=>p.documentId+":"+p.page).join(", ")} · {f.id}
        </option>)}
      </select>
    </label>)}
    <label className="field"><span>갈음이 증명해야 하는 기간 시작</span><input type="date" name="sub_period_start" required disabled={busy}/></label>
    <label className="field"><span>갈음이 증명해야 하는 기간 종료</span><input type="date" name="sub_period_end" required disabled={busy}/></label>
   </div>
   <label className="field"><span>원래 서류 발급 곤란 사유 (급여 대체 시 필수)</span>
     <textarea name="sub_exception" maxLength={3000} placeholder="급여원천징수영수증 제출이 불가피하게 어려운 구체적인 사유" disabled={busy}/></label>
   <label className="field" style={{display:"flex",gap:8,alignItems:"center"}}>
     <input type="checkbox" name="sub_signed" disabled={busy}/>사용자의 기명날인·서명 있는 급여명세/증명을 실제로 확인함
   </label>
   <label className="field"><span>담당자 갈음 판단 근거·사유</span>
     <textarea name="sub_reason" required maxLength={4000} placeholder="관할 실무준칙의 조항과 각 증명 항목이 충족되는 이유를 기록하세요." disabled={busy}/></label>
   {message&&<p role="alert" className="workflow-caution">{message}</p>}
   <button className="button button-outline" disabled={busy} type="submit">갈음 검토 기록 · 변경 시 자동 복구</button>
  </form>
 </details>;
}
