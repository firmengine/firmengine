/** A model-produced review draft becomes editable only after source-bound
 * staff handoff. Never converts a draft into a final court document.
 * No DB writes or external calls in this contract.
 */
export interface AutomaticDraftArtifact {
  id:string;kind:string;name:string;hash:string;mime:string;objectKey:string;
}
export interface AutomaticDraftRow {
  id:string;caseId:string;legalReviewRunId:string;dataVersion:number;
  caseRevision:number;status:string;artifactsJson:string;
}
export interface AutomaticDraftHead {
  dataVersion:number;calculationRunId:string;legalReviewRunId:string;
  calculationCaseRevision:number;legalCaseRevision:number;referenceSha256:string;
}
export interface AutomaticDraftOrigin {
  runId:string;legalReviewRunId:string;calculationRunId:string;
  sourceDataVersion:number;caseRevision:number;linkedBy:string;linkedAt:string;
}
export interface AutomaticDraftHandoffDecision {
  eligible:boolean;alreadyLinked:boolean;blockers:string[];
}
const hex=/^[a-f0-9]{64}$/i;
export function parseAutomaticDraftArtifacts(raw:string,caseId:string):AutomaticDraftArtifact[]{
  let value:unknown;
  try{value=JSON.parse(raw);}catch{throw new Error("AUTODRAFT_INVALID_ARTIFACT_JSON");}
  if(!Array.isArray(value)||value.length===0||value.length>30)
    throw new Error("AUTODRAFT_INVALID_ARTIFACT_SET");
  const ids=new Set<string>(),keys=new Set<string>(),kinds=new Set<string>();
  const results:AutomaticDraftArtifact[]=[];
  for(const row of value){
    if(!row||typeof row!=="object"||Array.isArray(row))throw new Error("AUTODRAFT_INVALID_ARTIFACT");
    const item=row as Record<string,unknown>;
    if(typeof item.id!=="string"||!item.id||typeof item.kind!=="string"||!item.kind
      ||typeof item.name!=="string"||!item.name||item.name.length>260
      ||typeof item.mime!=="string"||!item.mime
      ||typeof item.hash!=="string"||!hex.test(item.hash)
      ||typeof item.objectKey!=="string"||item.objectKey!==("cases/"+caseId+"/artifacts/"+item.id)
      ||ids.has(item.id)||keys.has(item.objectKey)||kinds.has(item.kind))
      throw new Error("AUTODRAFT_INVALID_ARTIFACT");
    ids.add(item.id);keys.add(item.objectKey);kinds.add(item.kind);
    results.push({id:item.id,kind:item.kind,name:item.name,hash:item.hash,mime:item.mime,objectKey:item.objectKey});
  }
  if(!kinds.has("rendered_json")||!kinds.has("package_zip"))
    throw new Error("AUTODRAFT_MANDATORY_RENDERED_ARTIFACT_MISSING");
  return results;
}
export function automaticDraftHandoffDecision(input:{
  row:AutomaticDraftRow|null;head:AutomaticDraftHead|null;
  caseId:string;caseRevision:number;currentReferenceSha256:string;
  artifacts:readonly AutomaticDraftArtifact[];
  existingCurrentFiles:readonly {id:string;hash:string}[];
  existingMode:string|null;
  existingOrigin:AutomaticDraftOrigin|null;
  pendingEdits:boolean;
}):AutomaticDraftHandoffDecision{
  const errors:string[]=[];
  const {row,head}=input;
  if(!row||row.caseId!==input.caseId||row.status!=="complete")
    errors.push("AUTODRAFT_CURRENT_COMPLETED_RUN_MISSING");
  if(!head||!row||row.dataVersion!==head.dataVersion||
    row.legalReviewRunId!==head.legalReviewRunId||
    row.caseRevision!==input.caseRevision||
    head.calculationCaseRevision!==input.caseRevision||
    head.legalCaseRevision!==input.caseRevision)
    errors.push("AUTODRAFT_SOURCE_OR_REVIEW_STALE");
  if(!head||head.referenceSha256!==input.currentReferenceSha256)
    errors.push("AUTODRAFT_REFERENCE_STALE");
  if(!input.artifacts.length)errors.push("AUTODRAFT_ARTIFACTS_MISSING");
  const origin=input.existingOrigin;
  const linked=!!row&&!!head&&!!origin&&origin.runId===row.id
    &&origin.legalReviewRunId===row.legalReviewRunId
    &&origin.calculationRunId===head.calculationRunId
    &&origin.sourceDataVersion===row.dataVersion
    &&origin.caseRevision===row.caseRevision
    &&input.existingMode==="draft"
    &&input.existingCurrentFiles.length===input.artifacts.length
    &&input.artifacts.every(a=>input.existingCurrentFiles.some(f=>f.id===a.id&&f.hash===a.hash));
  if(!linked&&input.existingMode==="final")errors.push("AUTODRAFT_PREVIOUS_FINAL_MANIFEST");
  if(!linked&&input.existingCurrentFiles.length)errors.push("AUTODRAFT_EXISTING_CURRENT_DOCUMENTS");
  if(!linked&&input.pendingEdits)errors.push("AUTODRAFT_UNAPPLIED_DOCUMENT_EDITS");
  return {eligible:errors.length===0,alreadyLinked:linked&&errors.length===0,
    blockers:[...new Set(errors)]};
}
