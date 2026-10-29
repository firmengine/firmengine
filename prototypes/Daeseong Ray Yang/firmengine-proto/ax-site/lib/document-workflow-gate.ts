export type FinalWorkflowRequirement = { requirementId:string; required:boolean; retired?:boolean; requirementStatus:string };
export type FinalWorkflowLegalCheck = { checkId:string; state:string; disposition?:string|null };
export type FinalWorkflowFeatureGap = {canonicalFieldId:string;code:string};

/** Final-only asynchronous workflow checks. Legacy cases without adopted workflow state retain the prior gate. */
export function finalWorkflowBlockers(input:{workflowAdopted:boolean;projectionBlockers?:readonly unknown[];requirements?:readonly FinalWorkflowRequirement[];legalChecks?:readonly FinalWorkflowLegalCheck[];featureGaps?:readonly FinalWorkflowFeatureGap[]}):string[]{
  if(!input.workflowAdopted)return [];
  const blockers:string[]=[];
  for(const [index] of (input.projectionBlockers??[]).entries())blockers.push(`projection:${index+1}`);
  const complete=new Set(["satisfied","not_applicable_confirmed","waived_by_review"]);
  for(const requirement of input.requirements??[]){
    if(requirement.required&&!requirement.retired&&!complete.has(requirement.requirementStatus))blockers.push(`requirement:${requirement.requirementId}:${requirement.requirementStatus}`);
  }
  // Only current run diagnostics are passed here. Historical dispositions are
  // intentionally ignored once a newer current run resolves them.
  for(const check of input.legalChecks??[]){
    if(check.state==="current"&&(check.disposition==="rejected"||check.disposition==="needs_review"))blockers.push(`legal:${check.checkId}:${check.disposition}`);
  }
  // Missing OCR is blocking only for fields in a reviewed active case requirement.
  // Caller audits the latest source snapshot and never marks all catalog fields mandatory.
  for(const field of input.featureGaps??[])blockers.push(`feature:${field.canonicalFieldId}:${field.code}`);
  return blockers;
}
