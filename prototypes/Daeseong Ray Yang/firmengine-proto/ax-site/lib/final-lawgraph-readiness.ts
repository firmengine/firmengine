/** P0 final-review requirement: the current legal AI review must be the one
 * computed from this case's current source version, calculator run and criteria.
 * This is NOT a judicial filing/approval decision and never replaces lawyers.
 */
import {listCaseLawgraphReview,type LegalConditionStatus} from "./case-lawgraph-store.ts";
import {RISK_CATALOG} from "./legal-rules.ts";
export const FINAL_LAWGRAPH_CONTRACT_VERSION="final-lawgraph-readiness/1" as const;
export type FinalLegalCheck = {id:string;status:LegalConditionStatus;factIds:string[]};
export type FinalHumanDisposition = {checkId:string;state:string;disposition:string|null};
export type FinalExpectedCheck = {id:string;required_features?:readonly string[];implementation?:{may_auto_clear?:boolean}};
export interface FinalLegalInputs {
 review:{runId:string|null;complete:boolean;headStale:boolean;currentDataVersion:number|null;currentCaseRevision:number;
    caseRevision:number|null;calculationRunId:string|null;inputSha256:string|null;expectedCheckIds:string[];checks:FinalLegalCheck[];documentFieldCount:number};
 currentCaseRevision:number;calculationRunId:string|null;calculationInputSha256:string|null;
 currentReferenceSha256:string;calculationReferenceSha256:string|null;
 expected:readonly FinalExpectedCheck[];humanDispositions:readonly FinalHumanDisposition[];
}
/** Pure fail-closed policy; only latest server-validated human dispositions count. */
export function finalLawgraphBlockers(input:FinalLegalInputs):string[]{
 const {review}=input,blocks:string[]=[];
 if(!review.runId)return ["LAWGRAPH_RUN_MISSING"];
 if(!review.complete)blocks.push("LAWGRAPH_REVIEW_INCOMPLETE");
 if(review.documentFieldCount===0)blocks.push("LAWGRAPH_FORM_FIELD_PROJECTION_MISSING");
 if(review.headStale||review.caseRevision!==input.currentCaseRevision||review.currentCaseRevision!==input.currentCaseRevision)blocks.push("LAWGRAPH_SOURCE_VERSION_STALE");
 if(!input.calculationRunId||review.calculationRunId!==input.calculationRunId||!input.calculationInputSha256||review.inputSha256!==input.calculationInputSha256)
   blocks.push("LAWGRAPH_CALCULATION_RUN_MISMATCH");
 if(!input.calculationReferenceSha256||input.calculationReferenceSha256!==input.currentReferenceSha256)
   blocks.push("LAWGRAPH_REFERENCE_RELEASE_STALE");
 const expectedIds=input.expected.map(check=>check.id),unique=new Set(expectedIds);
 if(!expectedIds.length||unique.size!==expectedIds.length||review.expectedCheckIds.length!==expectedIds.length
   ||new Set(review.expectedCheckIds).size!==expectedIds.length||review.expectedCheckIds.some(id=>!unique.has(id)))
   blocks.push("LAWGRAPH_EXPECTED_CHECK_CATALOG_MISMATCH");
 const seen=new Set<string>(),human=new Map(input.humanDispositions.filter(x=>x.state==="current").map(x=>[x.checkId,x.disposition]));
 for(const check of review.checks){
   if(seen.has(check.id)||!unique.has(check.id)){blocks.push("LAWGRAPH_DUPLICATE_OR_UNKNOWN_CHECK:"+check.id);continue;}
   seen.add(check.id);
   if(!["pass","not_applicable"].includes(check.status)){
     // A human-accepted current finding may resolve an advisory legal_review,
     // but never a verified failure, missing or contradictory source record.
     if(check.status!=="legal_review"||human.get(check.id)!=="accepted")
       blocks.push("LAWGRAPH_CHECK_UNRESOLVED:"+check.id+":"+check.status);
   }
   const policy=input.expected.find(x=>x.id===check.id)!;
   if((!policy.required_features?.length||policy.implementation?.may_auto_clear!==true)
      &&human.get(check.id)!=="accepted")
     blocks.push("LAWGRAPH_HUMAN_DECISION_REQUIRED:"+check.id);
   if(human.get(check.id)==="rejected"||human.get(check.id)==="needs_review")
     blocks.push("LAWGRAPH_HUMAN_DECISION_BLOCKED:"+check.id);
 }
 for(const id of expectedIds)if(!seen.has(id))blocks.push("LAWGRAPH_CHECK_MISSING:"+id);
 return [...new Set(blocks)];
}
export async function inspectCurrentFinalLawgraph(database:D1Database,input:{
 caseId:string;caseRevision:number;referenceSha256:string;humanDispositions?:readonly FinalHumanDisposition[]
}){
 const snapshot=await listCaseLawgraphReview(database,{caseId:input.caseId,limit:500});
 const calc=await database.prepare("SELECT h.run_id AS runId,r.input_sha256 AS inputSha256,r.reference_sha256 AS referenceSha256 FROM case_calculation_heads h JOIN case_calculation_runs r ON r.id=h.run_id WHERE h.case_id=?")
  .bind(input.caseId).first<{runId:string;inputSha256:string;referenceSha256:string}>();
 const expected=RISK_CATALOG as readonly FinalExpectedCheck[];
 const blockers=finalLawgraphBlockers({
  review:{runId:snapshot.runId,complete:snapshot.complete,headStale:snapshot.headStale,
   currentDataVersion:snapshot.currentDataVersion,currentCaseRevision:snapshot.currentCaseRevision,
   caseRevision:snapshot.caseRevision,calculationRunId:snapshot.calculationRunId,inputSha256:snapshot.inputSha256,
   expectedCheckIds:snapshot.expectedCheckIds,checks:snapshot.checks,documentFieldCount:snapshot.totalDocumentFields},
  currentCaseRevision:input.caseRevision,calculationRunId:calc?.runId??null,
  calculationInputSha256:calc?.inputSha256??null,
  currentReferenceSha256:input.referenceSha256,calculationReferenceSha256:calc?.referenceSha256??null,
  expected,humanDispositions:input.humanDispositions??[]
 });
 return {schemaVersion:FINAL_LAWGRAPH_CONTRACT_VERSION,caseId:input.caseId,
  currentDataVersion:snapshot.currentDataVersion,legalReviewRunId:snapshot.runId,
  calculationRunId:calc?.runId??null,referenceSha256:input.referenceSha256,
  expectedChecks:expected.length,actualChecks:snapshot.checks.length,
  readyForFinalReviewCopy:blockers.length===0,blockers,courtApprovalInferred:false as const,
  readyForElectronicFiling:false as const};
}
