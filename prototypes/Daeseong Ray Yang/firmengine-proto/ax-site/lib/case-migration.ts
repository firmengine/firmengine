import whitelist from "./evaluation-whitelist.json" with {type:"json"};
import { storedCaseMatchesImport } from "./structured-case-import.ts";
import { caseWorkflow } from "./case-workflow-state.ts";
import type { CaseData } from "./domain.ts";
export interface EvaluationWhitelistEntry { caseId:string;caseDataSha256:string;datasetManifestSha256:string; }
export interface EvaluationWhitelist { cases:EvaluationWhitelistEntry[]; }
/** Explicit copy only: fixture bytes/IDs and all original evidence states remain unchanged. */
export async function cloneEvaluationCase(source:CaseData,targetId:string,at:string,approved:EvaluationWhitelist=whitelist){
  const entry=approved.cases.find(e=>e.caseId===source.context.id);
  if(!entry||source.evaluationClone||source.context.revision!==1)throw new Error("EVALUATION_SOURCE_NOT_WHITELISTED");
  if(!await storedCaseMatchesImport(source,{caseData:source,caseDataSha256:entry.caseDataSha256},entry.datasetManifestSha256))throw new Error("EVALUATION_SOURCE_HASH_MISMATCH");
  if(!/^evaluation-clone-[a-zA-Z0-9_-]{8,128}$/.test(targetId))throw new Error("EVALUATION_CLONE_ID_REQUIRED");
  const clone=structuredClone(source);clone.context={...clone.context,id:targetId,revision:1,caseName:`[평가 복제] ${source.context.caseName}`};
  delete clone.exportManifest;delete clone.clientStateFingerprint;
  clone.workflowState=caseWorkflow();clone.evaluationClone={sourceCaseId:source.context.id,sourceInputSha256:entry.caseDataSha256,createdAt:at,finalSubmissionProhibited:true};
  return clone;
}
export function evaluationCloneMatchesSource(current:CaseData,source:CaseData,sourceInputSha256:string):boolean{
  return current.context.id.startsWith("evaluation-clone-")&&current.evaluationClone?.sourceCaseId===source.context.id&&current.evaluationClone.sourceInputSha256===sourceInputSha256&&current.evaluationClone.finalSubmissionProhibited===true;
}
