"use client";

import {useState,type FormEvent} from "react";
import type {CaseCommand} from "@/lib/case-command-contract";
import type {CommandSubmitOutcome} from "@/lib/command-submit-outcome";
type CommandDraft=Omit<CaseCommand,"commandId"|"payloadVersion"|"expectedRevision"|"expectedStateFingerprint">;
export interface ExportReviewView{
 mode:"draft"|"final"|null;fingerprint:string|null;issues:string[];
 reviews:{caseworker:{actor:string;at:string}|null;lawyer:{actor:string;at:string}|null};
}
/** The existing exportManifest is the only editable/reviewable document ledger.
 * An imported AI draft stays draft until a separately generated final copy
 * passes the normal two-step human review.
 */
export default function DocumentReviewFinalization(props:{
 caseId:string;review?:ExportReviewView;roles:string[];
 finalReady:boolean;pendingEdits:boolean;busy:boolean;
 onCommand:(draft:CommandDraft)=>Promise<CommandSubmitOutcome>;onRefresh:()=>Promise<void>;
}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [approvalReason,setApprovalReason]=useState("");
 const canEditor=props.roles.includes("case_editor");
 const canStaff=props.roles.includes("caseworker_review");
 const canLawyer=props.roles.includes("lawyer_review");
 const [role,setRole]=useState<"caseworker"|"lawyer">(canStaff?"caseworker":"lawyer");
 const review=props.review,blocked=props.busy||busy;
 const exportDocument=async(mode:"draft"|"final")=>{
  if(blocked)return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/cases/"+encodeURIComponent(props.caseId)+"/export",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({mode})
   });
   const result=await response.json().catch(()=>({})) as {error?:string;message?:string};
   if(!response.ok)throw new Error(result.error??result.message??"문서 재생성에 실패했습니다.");
   await props.onRefresh();
   setMessage(mode==="draft"?"수정 내용을 반영한 검토 초안이 다시 생성되었습니다.":"최종 검토본을 생성했습니다. 사람 검수는 아직 별도로 필요합니다.");
  }catch(cause){setError(cause instanceof Error?cause.message:"문서 저장 결과가 불분명합니다. 최신 목록을 확인하세요.");}
  finally{setBusy(false);}
 };
 const approve=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  if(blocked||!review?.fingerprint||!approvalReason.trim())return;
  if(role==="lawyer"&&!review.reviews.caseworker)return;
  setBusy(true);setError("");setMessage("");
  try{
   const outcome=await props.onCommand({
    commandType:"document.review",target:{},patch:{role,fingerprint:review.fingerprint},
    reason:approvalReason.trim()
   });
   if(outcome!=="committed"){
    setError(outcome==="rejected"
     ?"검수 저장이 거부되었습니다. 사유를 확인하고 현재 생성물의 승인 상태를 다시 검토하세요."
     :"저장 결과를 확정하지 못했습니다. 사유를 유지했습니다. 기존 명령 식별자로 다시 확인하세요.");
    return;
   }
   setApprovalReason("");
   setMessage("검수 명령 저장을 확인했습니다. 실제 법률 승인과 최종 서식 적합성은 별도 확인 사항입니다.");
  }catch(cause){
   setError(cause instanceof Error?cause.message:"검수 명령 저장 결과가 불분명합니다. 같은 명령으로 확인하세요.");
  }finally{setBusy(false);}
 };
 const finalExists=review?.mode==="final"&&!review.issues.length&&!!review.fingerprint;
 return <section className="panel" aria-label="서류 재생성 및 사람 검수">
  <div className="panel-heading"><div className="panel-title"><h2>서류 재생성 및 검수 기록</h2></div></div>
  <div className="workflow-panel-body">
   <p className="workflow-muted">자동 생성본은 검토용 초안이며, 담당자 문안 편집과 실제 최종 승인 기록은 동일한 생성물 ID·해시 원장에서 관리합니다.</p>
   {canEditor&&(props.pendingEdits||review?.mode==="draft")&&<button type="button" className="button button-outline" disabled={blocked} onClick={()=>void exportDocument("draft")}>수정사항 반영 · 검토 초안 재생성</button>}
   {canEditor&&props.finalReady&&<button type="button" className="button button-outline" disabled={blocked} onClick={()=>void exportDocument("final")}>현재 법률검토 기준 최종 검토본 생성</button>}
   {review?.issues?.length>0&&review.mode==="final"&&<div className="workflow-caution">
     <strong>현재 최종 검토본은 승인 불가</strong>{review.issues.slice(0,6).map((v,i)=><p key={i}>{v}</p>)}
   </div>}
   {finalExists&&<div className="workflow-form">
     <p>담당자 검수: {review?.reviews.caseworker?"완료":"대기"} · 변호사 검수: {review?.reviews.lawyer?"완료":"대기"}. 생성물을 변경하면 이 기록은 자동 무효화됩니다.</p>
     <form className="workflow-form" onSubmit={event=>void approve(event)}>
       <label className="field"><span>검수 역할</span><select value={role} onChange={e=>setRole(e.target.value as "caseworker"|"lawyer")}>
         {canStaff&&<option value="caseworker">담당자 검수</option>}
         {canLawyer&&<option value="lawyer">변호사 검수</option>}
       </select></label>
       <label className="field"><span>검수 사유 및 확인 내용</span><textarea value={approvalReason} onChange={e=>setApprovalReason(e.target.value)} maxLength={4000} required/></label>
       <button type="submit" className="button button-primary" disabled={blocked||(!canStaff&&!canLawyer)||(role==="lawyer"&&!review?.reviews.caseworker)||!approvalReason.trim()}>현재 전체 생성물 검수 기록</button>
     </form>
   </div>}
   {message&&<p className="workflow-muted" role="status">{message}</p>}
   {error&&<p className="workflow-caution" role="alert">{error}</p>}
  </div>
 </section>;
}
