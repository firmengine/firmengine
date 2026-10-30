/** Reference-catalog coverage review for PRE-approval. A declared feature key
 * is only a routing candidate; without source/recognized Fact, never legal pass.
 * Source-law edition/court scope require a human application decision.
 */
import type {CaseData,Fact} from "./domain.ts";
export const PREAPPROVAL_LEGAL_COVERAGE_VERSION="preapproval-legal-coverage/1" as const;
export interface CatalogRule{
 id:string;title:string;required_features?:readonly string[];
 source_url?:string;effective_date?:string;authority_scope?:string;
}
export interface CatalogException{
 id:string;trigger:string;features?:readonly string[];ruleRefs?:readonly string[];
 requiredDocuments?:readonly string[];missingAction?:string;decisionBoundary?:string;
 coverageGap?:string;
}
export function auditPreapprovalLegalCatalog(input:{
 caseData:CaseData;facts:readonly Fact[];sourceValidatedAcceptedFactIds:ReadonlySet<string>;
 rules:readonly CatalogRule[];exceptions:readonly CatalogException[];
}){
 const currentFacts=new Map<string,Fact[]>();
 for(const fact of input.facts){
  for(const key of new Set([fact.key,fact.canonicalFieldId??"",fact.fieldObservation?.canonicalFieldId??""])){
   if(!key)continue;
   const items=currentFacts.get(key)??[];items.push(fact);currentFacts.set(key,items);
  }
 }
 const byRule=new Map<string,Set<string>>();
 for(const exc of input.exceptions)for(const id of exc.ruleRefs??[]){
  const group=byRule.get(id)??new Set<string>();group.add(exc.id);byRule.set(id,group);
 }
 const caseDate=input.caseData.context.applicationDate,courtId=input.caseData.context.courtId;
 const postapprovalRules=new Set(["KR-PR-050"]);
 const rules=input.rules.map(rule=>{
  const requirements=(rule.required_features??[]).map(key=>{
   const observed=currentFacts.get(key)??[];
   const eligible=observed.filter(f=>input.sourceValidatedAcceptedFactIds.has(f.id));
   let enteredCaseValue:unknown=undefined;
   if(key.startsWith("context.")){
    const field=key.slice(8);
    if(Object.hasOwn(input.caseData.context,field))
      enteredCaseValue=(input.caseData.context as unknown as Record<string,unknown>)[field];
   }
   return {featureKey:key,observedFactIds:observed.map(f=>f.id),
    validatedAcceptedFactIds:eligible.map(f=>f.id),
    enteredCaseValuePresent:enteredCaseValue!==undefined&&enteredCaseValue!==null,
    status:eligible.length?"source_supported_needs_legal_application" as const:
      observed.length?"source_unverified_or_unaccepted" as const:
      "canonical_route_or_evidence_missing" as const};
  });
  const needs=requirements.filter(f=>f.status!=="source_supported_needs_legal_application");
  return {
   ruleId:rule.id,title:rule.title,sourceUrl:rule.source_url??null,
   executionScope:postapprovalRules.has(rule.id)?"postapproval_deferred" as const:"preapproval_candidate_only" as const,
   declaredFeatureCount:requirements.length,features:requirements,
   linkedExceptionIds:[...(byRule.get(rule.id)??[])],
   applicability:{courtId,applicationDate:caseDate,authorityScope:rule.authority_scope??null,
    catalogEditionEffectiveDate:rule.effective_date??null,
    editionAfterApplication:!!rule.effective_date&&!!caseDate&&caseDate<rule.effective_date,
    courtAndHistoricalApplicabilityReviewed:false as const},
   missingOrUnacceptedFeatureKeys:needs.map(f=>f.featureKey),
   status:postapprovalRules.has(rule.id)?"postapproval_deferred" as const:
     needs.length?"evidence_or_mapping_review_required" as const:
     "evidence_observed_but_legal_review_required" as const,
   legalFinding:null,courtApprovalInferred:false as const,
  };
 });
 const known=new Set(input.rules.map(r=>r.id));
 const deferred=new Set(["EL-40","EL-46"]);
 const exceptions=input.exceptions.map(e=>({
  exceptionId:e.id,trigger:e.trigger,declaredFeatureCandidates:[...(e.features??[])],
  ruleIds:[...(e.ruleRefs??[])],unmappedRuleIds:(e.ruleRefs??[]).filter(id=>!known.has(id)),
  candidateExistingFactIds:[...new Set((e.features??[]).flatMap(key=>(currentFacts.get(key)??[]).map(f=>f.id)))],
  requiredDocumentsFromCatalog:[...(e.requiredDocuments??[])],
  missingActionFromCatalog:e.missingAction??"",
  decisionBoundary:e.decisionBoundary??"",legacyCoverageGap:e.coverageGap??"",
  executionScope:deferred.has(e.id)?"postapproval_deferred" as const:"preapproval_candidate_only" as const,
  triggerEvaluation:"not_executed_by_this_audit" as const,
  automaticallySatisfied:false as const,courtApprovalInferred:false as const,
 }));
 const knownKeys=new Map<string,Set<string>>();
 for(const item of rules.filter(r=>r.executionScope==="preapproval_candidate_only"))for(const gap of item.missingOrUnacceptedFeatureKeys){
  const impacted=knownKeys.get(gap)??new Set<string>();impacted.add(item.ruleId);knownKeys.set(gap,impacted);
 }
 return {schemaVersion:PREAPPROVAL_LEGAL_COVERAGE_VERSION,
   caseId:input.caseData.context.id,caseRevision:input.caseData.context.revision,
   registeredRules:rules.length,registeredExceptions:exceptions.length,
   rules,exceptions,
   unansweredEvidenceQuestions:[...knownKeys].map(([key,ids])=>({featureKey:key,affectedRuleIds:[...ids]}))
    .sort((a,b)=>b.affectedRuleIds.length-a.affectedRuleIds.length||a.featureKey.localeCompare(b.featureKey)),
   unrecognizedRuleReferenceIds:[...new Set(exceptions.flatMap(e=>e.unmappedRuleIds))],
   allLegalOutcomesRequireHumanReview:true as const,
   sourceWasModified:false as const,courtApprovalInferred:false as const,
   note:"50 law catalogue entries and 46 exception catalogue entries are inspected as candidates only. A catalogue key, source URL or exact OCR match does not prove case applicability or legal sufficiency."};
}
