"use client";

import {useState,type FormEvent} from "react";
import type {CaseCommand} from "@/lib/case-command-contract";

type CommandDraft=Omit<CaseCommand,"commandId"|"payloadVersion"|"expectedRevision"|"expectedStateFingerprint">;
export type AutoDraftHandoffView={
 status:"none"|"candidate"|"linked"|"blocked"|"unavailable";
 canLink:boolean;runId:string|null;artifactCount:number;blockers:string[];
};
export type ExportReviewView={
 mode:"draft"|"final"|null;fingerprint:string|null;issues:string[];
 reviews:{caseworker:{actor:string;at:string}|null;lawyer:{actor:string;at:string}|null};
};
export default function AutomaticDraftHandoffPanel(props:{
 caseId:string;revision:number;stateFingerprint:string;
 handoff?:AutoDraftHandoffView;review?:ExportReviewView;roles:string[];
 finalReady:boolean;pendingEdits:boolean;busy:boolean;
 onCommand:(draft:CommandDraft)=>void|Promise<void>;onRefresh:()=>Promise<void>;
}){
 const [saving,setSaving]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [handoffReason,setHandoffReason]=useState("자동 생성 검토용 초안을 사건 서류 검토 목록에 연결하고 원문과 계산근거를 대조합니다.");
 const [approvalReason,setApprovalReason]=useState("");
 const [chosenRole,setChosenRole]=useState<"caseworker"|"lawyer">("caseworker");
 const isEditor=props.roles.includes("case_editor"),canCaseworker=props.roles.includes("caseworker_review"),canLawyer=props.roles.includes("lawyer_review");
 const mode=props.review?.mode;
 const exec=async(path:string,body:Record<string,unknown>,success:string)=>{
  if(saving||props.busy)return;
  setSaving(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/cases/"+encodeURIComponent(props.caseId)+"/"+path,{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
   });
   const result=await response.json().catch(()=>({})) as {error?:string;message?:string};
   if(!response.ok)throw new Error(result.error??result.message??"문서 처리 요청이 실패했습니다.");
   await props.onRefresh();setMessage(success);
  }catch(cause){setError(cause instanceof Error?cause.message:"저장 결과를 확인하지 못했습니다. 먼저 최신 상태를 조회하세요.");}
  finally{setSaving(false);}
 };
 const handoff=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(!props.handoff?.canLink||!props.handoff.runId||!handoffReason.trim())return;
  void exec("automatic-draft-handoff",{
   runId:props.handoff.runId,expectedRevision:props.revision,
   expectedStateFingerprint:props.stateFingerprint,reason:handoffReason.trim()
  },"검토용 초안을 기존 문서 편집 원장에 연결했습니다. 문구만 직접 수정할 수 있으며 법원 제출 승인은 별도입니다.");
 };
 const makeDocument=(mode:"draft"|"final")=>{
  void exec("export",{mode},mode==="draft"?"현재 수정사항을 반영한 새 검토용 문서가 작성되었습니다.":"최종 검토본을 생성했습니다. 담당자와 변호사의 검수 기록이 별도로 필요합니다.");
 };
 const approve=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(!props.review?.fingerprint||!approvalReason.trim())return;
  void Promise.resolve(props.onCommand({commandType:"document.review",target:{},
   patch:{role:chosenRole,fingerprint:props.review.fingerprint},reason:approvalReason.trim()}));
  setApprovalReason("");
 };
 const candidate=props.handoff;
 const allowFinal=props.finalReady && isEditor && !saving && !props.busy;
 const canApprove=mode==="final"&&!props.review?.issues.length&&!!props.review?.fingerprint;
 return <section className="panel" aria-label="자동초안 직원 검토 인계">
  <div className="panel-heading"><div className="panel-title"><h2>자동초안 · 직원 문서 검토</h2></div></div>
  <div className="workflow-panel-body">
   <p className="workflow-muted">자동 생성본은 검토용입니다. 동일한 서류 ID·바이트 해시로 확인한 뒤 기존 서식 편집 원장에 연결합니다. 법원 제출·인가 또는 변호사 승인이 아닙니다.</p>
   {candidate?.status==="candidate"&&isEditor&&<form className="workflow-form" onSubmit={handoff}>
     <p>현재 법률검토 판본의 자동초안 {candidate.artifactCount}개를 기존 문서 편집 화면에서 사용하도록 연결합니다.</p>
     <label className="field"><span>연결 사유</span><textarea value={handoffReason} onChange={event=>setHandoffReason(event.target.value)} required maxLength={4000}/></label>
     <button className="button button-primary" type="submit" disabled={saving||props.busy||!handoffReason.trim()}>자동초안 검토 원장 연결</button>
   </form>}
   {candidate?.status==="linked"&&<p className="workflow-muted">자동 생성본 {candidate.artifactCount}개가 문서 편집 목록에 연결됐습니다. 금액·사실 변경은 원천에서 수정하세요.</p>}
   {candidate?.status==="blocked"&&<div className="workflow-caution">
    <strong>자동초안 검토 원장 연결 보류</strong>
    {candidate.blockers.slice(0,8).map(code=><p key={code}>{code}</p>)}
    <p>이미 편집한 문서나 최종 검수본을 자동초안으로 덮어쓰지 않습니다.</p>
   </div>}
   {isEditor&&(candidate?.status==="linked"||props.pendingEdits||mode==="draft")&&<button className="button button-outline" type="button" disabled={saving||props.busy} onClick={()=>makeDocument("draft")}>수정사항으로 검토용 초안 재생성</button>}
   {allowFinal&&<button className="button button-outline" type="button" onClick={()=>makeDocument("final")}>최신 법률검토 기준으로 최종 검토본 생성</button>}
   {canApprove&&<div className="workflow-form">
     <p>현재 최종 검토본의 승인 여부는 문서 ID·해시 전체 지문에 결속됩니다. 재생성하면 이전 검수는 승계하지 않습니다.</p>
     <p>담당자 검수: {props.review?.reviews.caseworker?"완료 ("+props.review.reviews.caseworker.actor+")":"대기"} · 변호사 검수: {props.review?.reviews.lawyer?"완료 ("+props.review.reviews.lawyer.actor+")":"대기"}</p>
     <form className="workflow-form" onSubmit={approve}>
       <label className="field"><span>검토 역할</span><select value={chosenRole} onChange={e=>setChosenRole(e.target.value as "caseworker"|"lawyer")}>
         {canCaseworker&&<option value="caseworker">담당자 확인</option>}
         {canLawyer&&<option value="lawyer">변호사 확인</option>}
       </select></label>
       <label className="field"><span>검토 근거와 사유</span><textarea value={approvalReason} onChange={e=>setApprovalReason(e.target.value)} maxLength={4000} required /></label>
       <button className="button button-primary" disabled={saving||props.busy||(!canCaseworker&&!canLawyer)||(chosenRole==="lawyer"&&!props.review?.reviews.caseworker)} type="submit">현재 파일 전체 검수 기록</button>
     </form>
   </div>}
   {message&&<p className="workflow-muted" role="status">{message}</p>}
   {error&&<p className="workflow-caution" role="alert">{error}</p>}
  </div>
 </section>;
}
