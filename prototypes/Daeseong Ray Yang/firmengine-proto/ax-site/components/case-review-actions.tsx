"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, FileText, Loader2, LockKeyhole } from "lucide-react";
import type { CaseCommand } from "@/lib/case-command-contract";
import type { CommandSubmitOutcome } from "@/lib/command-submit-outcome";

type CommandDraft = Omit<CaseCommand,"commandId"|"payloadVersion"|"expectedRevision"|"expectedStateFingerprint">;
export type ReviewArtifact = {id:string;name:string;hash:string;formCode:string|null;status:string};
export type ReviewFieldBase = {artifactId:string;artifactHash:string;formCode:string;fieldId:string;rowId:string|null;kind:"prose"|"layout";value:string;baseValueHash:string};
export type CurrentLegalRun = {runId:string;checkId:string;title?:string;status:string;factIds:string[];truncated?:boolean;coverageComplete?:boolean;conflict?:boolean;conflictingStatuses?:string[];conflictingRunIds?:string[];conflictingFactIds?:string[]};
export type CaseReviewActionsProps = {
  revision:number;
  stateFingerprint:string;
  artifacts:ReviewArtifact[];
  fieldBases:ReviewFieldBase[];
  legalRuns?:CurrentLegalRun[];
  roles?:string[];
  onCommand:(draft:CommandDraft)=>Promise<CommandSubmitOutcome>;
  onError?:(message:string)=>void;
  busy?:boolean;
};
const fieldLabel=(fieldId:string)=>fieldId.replaceAll("_"," ").replaceAll("."," · ");
const REQUIRED_REASON="구체적인 변경 이유를 입력하세요.";

/** Reusable workflow controls; the parent supplies its durable command/retry handler. */
export default function CaseReviewActions({artifacts,fieldBases,legalRuns=[],roles=[],onCommand,onError,busy=false}:CaseReviewActionsProps){
  const currentArtifacts=artifacts.filter(item=>item.status==="current");
  const [artifactId,setArtifactId]=useState(currentArtifacts[0]?.id??"");
  const [selectedLegalKey,setSelectedLegalKey]=useState(legalRuns[0]?`${legalRuns[0].runId}:${legalRuns[0].checkId}`:"");
  const selectedLegalRun=legalRuns.find(run=>`${run.runId}:${run.checkId}`===selectedLegalKey);
  const artifact=currentArtifacts.find(item=>item.id===artifactId)??currentArtifacts[0];
  const editable=useMemo(()=>artifact?fieldBases.filter(base=>base.artifactId===artifact.id&&base.artifactHash===artifact.hash&&base.formCode===artifact.formCode):[],[artifact,fieldBases]);
  const saveEdit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!artifact||busy)return;
    const element=event.currentTarget,form=new FormData(element),base=editable[Number(form.get("baseIndex"))],value=String(form.get("value")??""),reason=String(form.get("reason")??"").trim();
    if(!base||!reason){onError?.(REQUIRED_REASON);return;}
    if(base.artifactId!==artifact.id||base.artifactHash!==artifact.hash){onError?.("현재 생성물이 바뀌었습니다. 최신 상태를 다시 불러오세요.");return;}
    try{
      const outcome=await onCommand({commandType:"document.edit",target:{artifactId:base.artifactId,fieldId:base.fieldId,...(base.rowId?{rowId:base.rowId}:{})},patch:{baseValue:base.value,value},reason,baseValueHash:base.baseValueHash});
      if(outcome!=="committed")throw new Error(outcome==="rejected"?"문서 편집 저장이 거부되었습니다. 현재 생성물을 다시 확인하세요.":"문서 편집 저장 결과가 불분명합니다. 같은 명령으로 다시 확인하세요.");
      element.reset();
    }
    catch(cause){onError?.(cause instanceof Error?cause.message:"문서 편집을 저장하지 못했습니다.");}
  };
  const submitLegal=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(busy)return;
    const form=new FormData(event.currentTarget),[runId,checkId]=String(form.get("legalRunKey")??"").split(":"),status=String(form.get("status")??"needs_review"),role=String(form.get("role")??"caseworker"),evidenceFactIds=form.getAll("evidenceFactIds").map(String),reason=String(form.get("reason")??"").trim();
    const run=legalRuns.find(item=>item.runId===runId&&item.checkId===checkId);
    if(!run||run.truncated||run.coverageComplete===false||!run.factIds.length||!reason){onError?.("현재 완전한 법률 실행, 근거 사실과 이유를 확인하세요.");return;}
    if(run.conflict&&status==="accepted"){onError?.("현재 실행 결과가 상충합니다. 충돌을 해결하기 전에는 검토 완료로 기록할 수 없습니다.");return;}
    void Promise.resolve(onCommand({commandType:"legalCheck.dispose",target:{runId,checkId},patch:{status,evidenceFactIds,role},reason})).then(outcome=>{if(outcome!=="committed")onError?.(outcome==="rejected"?"법률 검토 기록이 거부되었습니다. 현재 근거를 확인하세요.":"법률 검토 기록이 확정되지 않았습니다. 같은 명령으로 결과를 확인하세요.");}).catch(cause=>onError?.(cause instanceof Error?cause.message:"법률 검토를 저장하지 못했습니다."));
  };
  const canReviewAsCaseworker=roles.includes("caseworker_review"),canReviewAsLawyer=roles.includes("lawyer_review");
  return <section className="case-review-actions" aria-label="문서 편집 및 법률 검토">
    <section className="panel"><div className="panel-heading"><div className="panel-title"><FileText size={17}/><h2>문서 문안·배치 수정</h2></div></div><div className="workflow-panel-body">
      <p className="workflow-muted">문안과 항목 순서만 현재 생성물에 덧붙입니다. 금액·사실·판단 값은 원천 사건 항목에서 수정한 뒤 다시 계산하세요.</p>
      {!currentArtifacts.length?<p className="workflow-muted">수정할 현재 생성물이 없습니다.</p>:<>
        <label className="field"><span>현재 생성물</span><select value={artifact?.id??""} onChange={event=>setArtifactId(event.currentTarget.value)}>{currentArtifacts.map(item=><option key={item.id} value={item.id}>{item.name} · {item.formCode}</option>)}</select></label>
        <form className="workflow-form" onSubmit={event=>void saveEdit(event)}><div className="form-grid">
          <label className="field"><span>수정할 문안·배치 항목</span><select name="baseIndex" required defaultValue=""><option value="" disabled>항목 선택</option>{editable.map((base,index)=><option key={`${base.fieldId}:${base.rowId??"scalar"}:${index}`} value={index}>{fieldLabel(base.fieldId)}{base.rowId?` · ${base.rowId}`:""} · 현재값 {base.value}</option>)}</select><small>현재 artifact ID와 해시에 등록된 필드만 편집할 수 있습니다.</small></label>
          <label className="field"><span>새 문안·배치 값</span><textarea name="value" required maxLength={20000} /></label>
          <label className="field"><span>변경 이유</span><textarea name="reason" required maxLength={4000} placeholder="확인한 내용과 변경 이유" /></label>
        </div><button className="button button-primary" type="submit" disabled={busy||!editable.length}>{busy?<Loader2 size={15} className="spin"/>:<CheckCircle2 size={15}/>}문서 편집 기록</button></form>
        <p className="workflow-caution"><LockKeyhole size={14}/>금액·원천·계산 필드는 문서 overlay로 수정할 수 없습니다. 해당 사건 항목을 수정하세요.</p>
      </>}
    </div></section>
    {legalRuns.length>0&&<section className="panel"><div className="panel-heading"><div className="panel-title"><CheckCircle2 size={17}/><h2>법률 검토 처분</h2></div></div><div className="workflow-panel-body"><p className="workflow-muted">현재 서버 검증 실행에 대한 사람의 처분을 기록합니다. 실행 결과는 자동 승인이나 법원 결정이 아닙니다.</p><form className="workflow-form" onSubmit={submitLegal}><div className="form-grid">
      <label className="field"><span>현재 검토 실행·항목</span><select name="legalRunKey" required value={selectedLegalKey} onChange={event=>setSelectedLegalKey(event.currentTarget.value)}><option value="" disabled>실행 선택</option>{legalRuns.map(run=><option key={`${run.runId}:${run.checkId}`} value={`${run.runId}:${run.checkId}`} disabled={run.truncated||run.coverageComplete===false||!run.factIds.length}>{run.title??run.checkId}{run.conflict?" · 충돌":""} · {run.status}</option>)}</select></label>
      <label className="field"><span>처분</span><select name="status" defaultValue="needs_review"><option value="needs_review">추가 검토 필요</option><option value="accepted">검토 완료</option><option value="rejected">제안 반려</option></select></label>
      <label className="field"><span>검토자 역할</span><select name="role" required defaultValue={canReviewAsLawyer&&!canReviewAsCaseworker?"lawyer":"caseworker"}>{canReviewAsCaseworker&&<option value="caseworker">담당자 검토</option>}{canReviewAsLawyer&&<option value="lawyer">변호사 검토</option>}</select></label>
      <label className="field"><span>근거 사실 ID</span><select name="evidenceFactIds" required multiple size={Math.min(5,Math.max(2,selectedLegalRun?.factIds.length??1))}>{[...new Set(selectedLegalRun?.factIds??[])].map(id=><option key={id} value={id}>{id}</option>)}</select><small>현재 실행에 포함된 근거만 저장할 수 있습니다.</small></label>
      <label className="field"><span>검토 이유</span><textarea name="reason" required maxLength={4000} /></label>
    </div>{selectedLegalRun?.conflict&&<div className="workflow-caution" role="alert"><strong>현재 실행 결과 충돌</strong><p>같은 검토 항목에서 {selectedLegalRun.conflictingStatuses?.join(", ")} 상태가 확인됐습니다. 실행 {selectedLegalRun.conflictingRunIds?.join(", ")} · 근거 사실 {selectedLegalRun.conflictingFactIds?.join(", ")||"없음"}. 근거를 대조하고 충돌을 해결하기 전에는 완료 처분을 기록할 수 없습니다.</p></div>}<button className="button button-primary" type="submit" disabled={busy||(!canReviewAsCaseworker&&!canReviewAsLawyer)}>{busy?<Loader2 size={15} className="spin"/>:<CheckCircle2 size={15}/>}검토 처분 기록</button></form></div></section>}
  </section>;
}
