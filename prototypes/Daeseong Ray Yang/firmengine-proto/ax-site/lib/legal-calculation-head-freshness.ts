/** Preflight freshness fence for deterministic calculation inputs to legal AI.
 * This is neither a determination of recognized income nor court approval.
 * Stored rows must remain immutable; reject an incompatible head instead.
 */
export interface LegalCalculationHeadSnapshot {
  caseRevision:number; dataVersion:number|null;
  headRevision:number; headDataVersion:number; headInputSha256:string;
  runId:string; runRevision:number; runDataVersion:number;
  runInputSha256:string; runReferenceSha256:string;
}
const isSha=(value:unknown):value is string=>typeof value==="string"&&/^[0-9a-f]{64}$/i.test(value);
export function isCurrentLegalCalculationHead(
  head:LegalCalculationHeadSnapshot|null|undefined,
  expectedCaseRevision:number,
  activeReferenceSha256:string,
):boolean {
  if(!head||!Number.isSafeInteger(expectedCaseRevision)||expectedCaseRevision<1||
     !Number.isSafeInteger(head.dataVersion)||head.dataVersion<0||
     !isSha(activeReferenceSha256)||!isSha(head.runReferenceSha256)||
     !isSha(head.runInputSha256)||!isSha(head.headInputSha256)||
     typeof head.runId!=="string"||!/^calculation-[0-9a-f]{64}$/i.test(head.runId))return false;
  return head.caseRevision===expectedCaseRevision&&
    head.headRevision===expectedCaseRevision&&head.runRevision===expectedCaseRevision&&
    head.headDataVersion===head.dataVersion&&head.runDataVersion===head.dataVersion&&
    head.runInputSha256===head.headInputSha256&&
    head.runReferenceSha256===activeReferenceSha256;
}
