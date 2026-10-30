/** Pure decision policy for review-only legal drafting. No AI result authorizes filing. */
export const AUTOMATIC_LEGAL_POLICY_VERSION="legal-auto-decision/1" as const;
export type LegalAutoConditionStatus="pass"|"fail"|"missing"|"conflict"|"not_applicable"|"legal_review";
export interface AutoLegalCondition {
 id:string;status:LegalAutoConditionStatus;reason:string;factIds:string[];
 ruleIds:string[];missingDocuments:string[];nextAction:string;
}
export function summarizeAutomaticLegalReview(input:{
 checks:readonly AutoLegalCondition[];expectedCount:number;
 draftEligibility?:{eligible:boolean;reasons:readonly string[]}|null;
 calculationIssues?:readonly string[];
}){
 const counts={pass:0,fail:0,missing:0,conflict:0,not_applicable:0,legal_review:0};
 for(const c of input.checks)counts[c.status]++;
 const complete=input.checks.length===input.expectedCount
   &&new Set(input.checks.map(c=>c.id)).size===input.expectedCount;
 // A missing or incorrect OCR financial input must not be hidden by a legal AI pass.
 const materialGaps=[...new Set((input.calculationIssues??[]).filter(
   issue=>/^CALC_INPUT_(?:UNCONNECTED_MATERIAL|AMOUNT_INVALID|AMOUNT_MISMATCH|SOURCE_INVALID):/.test(issue)))];
 const hardBlock=counts.fail+counts.missing+counts.conflict>0||materialGaps.length>0;
 const reviewPending=counts.legal_review>0;
 const blockers=[...(complete?[]:["LEGAL_REVIEW_INCOMPLETE"]),
   ...(counts.fail?["LEGAL_CONDITION_FAILED"]:[]),
   ...(counts.conflict?["LEGAL_FACT_CONFLICT"]:[]),
   ...(counts.missing?["LEGAL_EVIDENCE_MISSING"]:[]),
   ...(materialGaps.length?["CALCULATION_SOURCE_RECONCILIATION_REQUIRED"]:[]),
   ...(!input.draftEligibility?.eligible?(input.draftEligibility?.reasons??["DRAFT_ELIGIBILITY_NOT_CHECKED"]):[])];
 const draftCandidate=complete&&!hardBlock&&input.draftEligibility?.eligible===true;
 const findings=input.checks.filter(c=>!["pass","not_applicable"].includes(c.status)).map(c=>({
   id:c.id,status:c.status,reason:c.reason,missingDocuments:[...c.missingDocuments],
   nextAction:c.nextAction,factIds:[...c.factIds],ruleIds:[...c.ruleIds]}));
 return {version:AUTOMATIC_LEGAL_POLICY_VERSION,
   disposition:(!complete?"incomplete":hardBlock?"attention_required":draftCandidate?"draft_candidate":"review_required") as "incomplete"|"attention_required"|"draft_candidate"|"review_required",
   complete,counts,reviewPending,humanReviewRequired:reviewPending||hardBlock,
   draftCandidate,blockers:[...new Set(blockers)],findings,
   calculationIssues:[...new Set(input.calculationIssues??[])],
   courtApprovalInferred:false as const,canFinalize:false as const};
}
