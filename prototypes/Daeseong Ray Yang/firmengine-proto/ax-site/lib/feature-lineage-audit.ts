/** The complete canonical-field inventory, plus explicit limits on inferred legal use.
 * All output links below are review CANDIDATES until a current case, legal rule,
 * verified source and official template have each been checked independently.
 */
import type {IntakeCatalog} from "./intake-types.ts";
import type {CaseData} from "./domain.ts";
import {createCaseReadIndex,currentFacts,factSourceLineageIssues,validSourceRef} from "./domain.ts";
import {buildSharedDocumentCatalog,sharedDocumentFieldContract} from "./shared-document-catalog.ts";
import {bindCanonicalSourceField,canonicalProjectionKey} from "./canonical-field-binding.ts";
import {OCR_DECLARED_FORM_TARGETS} from "./ocr-chain-matrix.ts";
import {FORM_CONTRACTS} from "./form-contracts.ts";
import {WORKFLOW_RULES} from "./workflow-rules.ts";
import {RISK_CATALOG} from "./legal-rules.ts";
import practice from "./court-practice-gap-catalog.json" with {type:"json"};

export const FEATURE_LINEAGE_VERSION="ocr-feature-lineage/1";
const categories=["person","income","debt","asset","transaction","household","business","statement","other"] as const;
const distinct=(values:string[])=>[...new Set(values)].sort();
const hasPeriod=(role:string,family:string)=>role!=="not_applicable"||/income|payroll|tax|contribution|transaction|accounting|ledger|medical|education/.test(family);
const hasUnit=(type:string)=>/money|amount|quantity|ratio|decimal|integer/.test(type);
type CandidateStatus="review_candidate_not_proven";
function reviewScope(family:string,canonicalFieldId:string){
 const income=/income|payroll|wage|employment|business_sales|business_cost|accounting|pension_benefit/.test(family);
 const debt=/debt|credit|claim|arrear|tax_public|guarantee|garnishment/.test(family);
 const asset=/asset|property|vehicle|insurance|lease|bank_account|securities|crypto|disposition|transfer|receivable|retirement/.test(family);
 const household=/household|medical|education|childcare|identity|residence/.test(family);
 const procedure=/procedure|application|court_order|enforcement|narrative|case_specific|prior/.test(family);
 const forms:string[]=[];
 if(income)forms.push("D5103","D5110");
 if(debt)forms.push("D5106","D5110");
 if(asset)forms.push("D5101","D5110");
 if(household)forms.push("D5100","D5103","D5105");
 if(procedure)forms.push("D5100","D5105");
 if(!forms.length)forms.push("EVIDENCE_INDEX");
 const laws=["KR-ACT-589","KR-RULE-79","SEOUL-402"];
 if(income)laws.push("KR-ACT-579","KR-ACT-611");
 if(debt)laws.push("KR-ACT-579","KR-ACT-614");
 if(asset)laws.push("KR-ACT-614");
 if(household)laws.push("KR-ACT-579","SEOUL-405");
 if(family.includes("spouse"))laws.push("SEOUL-406");
 // Document-extension IDs can be routed through generic asset families.
 if(family.includes("securities")||family.includes("crypto")||/^(?:crypto_balance|securities_balance)::/.test(canonicalFieldId))laws.push("SEOUL-408");
 if(procedure)laws.push("KR-ACT-611","SEOUL-424-current-version-unverified");
 return {forms:distinct(forms),laws:distinct(laws)};
}
function calculatedFrom(typed:{recordCategory:string;key:string}[]){
 const ids:string[]=[];
 for(const t of typed){
  if(t.recordCategory==="income"&&["net","gross","expenses","period_start","period_end"].includes(t.key))ids.push("income_average","income_aggregation","monthlyIncomeWon");
  if(t.recordCategory==="debt"&&["principal_balance","principal","interest","creditor","as_of"].includes(t.key))ids.push("debt_total","debtPrincipalWon","debtInterestWon");
  if(t.recordCategory==="asset"&&["gross_value","kind","as_of","secured_payoff","valuation_basis"].includes(t.key))ids.push("asset_liquidation","liquidationValueWon");
 }
 return distinct(ids);
}
function formCandidates(id:string,forms:string[]){
 const exact=OCR_DECLARED_FORM_TARGETS[id]?.forms??[];
 const candidates=exact.flatMap(value=>{
  const [code,...rest]=value.split("."),token=rest.join(".");
  if(!FORM_CONTRACTS[code]?.fields.some(f=>f.token===token))return [];
  return [{code,token,status:"declared_source_or_derived_candidate_not_verified" as const}];
 });
 for(const code of forms)if(FORM_CONTRACTS[code]&&!candidates.some(c=>c.code===code))candidates.push({code,token:"",status:"declared_source_or_derived_candidate_not_verified"});
 return candidates;
}
export function buildFeatureLineageAudit(catalog:IntakeCatalog,catalogSha256:string,input:{canonicalFieldId?:string;familyId?:string;limit?:number;offset?:number}={}){
 const docs=buildSharedDocumentCatalog(catalog,catalogSha256);
 const index=new Map<string,any>();
 for(const doc of docs.documents)for(const route of doc.fieldContracts){
  const contract=sharedDocumentFieldContract(doc.documentTypeId,route.familyId);
  if(!contract)throw new Error("FEATURE_LINEAGE_SCHEMA_MISSING");
  for(const f of contract.fields){
   const id=f.global_field_id,source=bindCanonicalSourceField({key:f.local_id,canonicalFieldId:id},contract);
   if(source.canonicalFieldId!==id)throw new Error("FEATURE_LINEAGE_ID_MISMATCH:"+id);
   const typed=categories.flatMap(category=>{
    const key=canonicalProjectionKey(contract,source,category);
    return key?[{recordCategory:category,key,caseFactKey:category+"."+key,sourceFamilyId:route.familyId,proof:"explicit_converter_declared"}]:[];
   });
   const workflow=WORKFLOW_RULES.filter(w=>w.documents.some(d=>d.type===doc.documentTypeId))
    .map(w=>({id:w.id,ruleIds:[...w.ruleIds],link:"document_type_route_only_not_execution_proof" as const}));
   const linkedRuleIds=new Set(workflow.flatMap(w=>w.ruleIds));
   const risks=RISK_CATALOG.filter(r=>r.current_rule_ids?.some(id=>linkedRuleIds.has(id))).map(r=>({id:r.id,kind:"shared_rule_catalog_candidate" as CandidateStatus}));
   const scope=reviewScope(route.familyId,id),forms=formCandidates(id,scope.forms),calc=calculatedFrom(typed);
   const existing=index.get(id);
   if(existing){
    // The same document extension ID can validly be declared under several
    // source families. Keep each family's routing identity; reject semantic collisions.
    if(existing.localKey!==f.local_id||existing.datatype!==f.datatype||existing.unit!==f.canonical_unit)
      throw new Error("FEATURE_LINEAGE_ID_COLLISION:"+id);
    existing.familyIds=distinct([...existing.familyIds,route.familyId]);
    existing.documentTypeIds.push(doc.documentTypeId);
    existing.sourceSlots++;
    for(const item of typed)if(!existing.typedProjections.some((x:any)=>
      x.recordCategory===item.recordCategory&&x.caseFactKey===item.caseFactKey&&x.sourceFamilyId===item.sourceFamilyId))
      existing.typedProjections.push(item);
    existing.calculations=distinct([...existing.calculations.map((x:any)=>x.id),...calc]).map(id=>({id,status:"depends_on_verified_case_objects_not_raw_ocr"}));
    for(const item of forms)if(!existing.forms.some((x:any)=>x.code===item.code&&x.token===item.token))existing.forms.push(item);
    existing.legal.referenceReviewCandidates=distinct([...existing.legal.referenceReviewCandidates,...scope.laws]);
    for(const item of workflow)if(!existing.legal.workflowRouteCandidates.some((x:any)=>x.id===item.id))existing.legal.workflowRouteCandidates.push(item);
    for(const item of risks)if(!existing.legal.riskCheckCandidates.some((x:any)=>x.id===item.id))existing.legal.riskCheckCandidates.push(item);
    existing.sourceRequirements.periodIdentity ||= hasPeriod(f.temporal_role,route.familyId);
    existing.gaps=[...(existing.typedProjections.length?[]:["CASE_TYPED_CONSUMER_NOT_DECLARED"]),
      ...(existing.forms.some((x:any)=>x.token)?[]:["OFFICIAL_FORM_TOKEN_NOT_EXPLICITLY_LINKED"]),
      ...(existing.legal.riskCheckCandidates.length?[]:["LEGAL_RISK_SOURCE_FIELD_NOT_EXPLICITLY_LINKED"]),
      "OFFICIAL_EFILING_REQUIREDNESS_NOT_VERIFIED"];
    continue;
   }
   const gaps=[...(typed.length?[]:["CASE_TYPED_CONSUMER_NOT_DECLARED"]),
     ...(forms.some(x=>x.token)?[]:["OFFICIAL_FORM_TOKEN_NOT_EXPLICITLY_LINKED"]),
     ...(risks.length?[]:["LEGAL_RISK_SOURCE_FIELD_NOT_EXPLICITLY_LINKED"]),
     "OFFICIAL_EFILING_REQUIREDNESS_NOT_VERIFIED"];
   index.set(id,{canonicalFieldId:id,familyId:route.familyId,familyIds:[route.familyId],localKey:f.local_id,label:f.label,datatype:f.datatype,
    unit:f.canonical_unit,temporalRole:f.temporal_role,subjectRole:f.subject_entity_role,
    documentTypeIds:[doc.documentTypeId],sourceSlots:1,
    database:{recordTable:"extraction_records",featureTable:"extracted_features",missingTable:"extraction_field_coverage",
      rawColumn:"raw_value_json",fieldIdColumn:"canonical_field_id",identity:"document_id/page/record_ordinal/field_ordinal/source_sha256"},
    typedProjections:typed,
    legal:{referenceReviewCandidates:scope.laws,workflowRouteCandidates:workflow,riskCheckCandidates:risks,
      approvalInferred:false,legalRequiredness:"case_condition_and_court_review_needed"},
    calculations:calc.map(calcId=>({id:calcId,status:"depends_on_verified_case_objects_not_raw_ocr" as const})),
    forms, sourceRequirements:{recordIdentity:true,subjectIdentity:true,periodIdentity:hasPeriod(f.temporal_role,route.familyId),
      explicitAmountUnit:hasUnit(f.datatype),sourceLocator:true,legalRecognitionSeparate:true},
    blockerPolicy:{unobserved:"not_observed_not_zero_or_inapplicable",contradiction:"requires_review",
      final:"block_only_if_a_current_reviewed_case_requirement_depends_on_this_field"},
    gaps});
  }
 }
 const all=[...index.values()].map((x:any)=>({...x,documentTypeIds:distinct(x.documentTypeIds)}))
  .sort((a:any,b:any)=>a.canonicalFieldId.localeCompare(b.canonicalFieldId));
 const selection=all.filter((x:any)=>(!input.canonicalFieldId||x.canonicalFieldId===input.canonicalFieldId)&&(!input.familyId||x.familyIds.includes(input.familyId)));
 const limit=input.limit??100,offset=input.offset??0;
 if(!Number.isSafeInteger(limit)||limit<1||limit>1000||!Number.isSafeInteger(offset)||offset<0)throw new Error("INVALID_FEATURE_LINEAGE_PAGE");
 const page=selection.slice(offset,offset+limit),unmapped=all.filter((x:any)=>x.typedProjections.length===0);
 return {schemaVersion:FEATURE_LINEAGE_VERSION,catalogVersion:catalog.version,catalogSha256,summary:{
   documentTypes:docs.documents.length,canonicalFieldIds:all.length,sourceSlots:all.reduce((s:number,x:any)=>s+x.sourceSlots,0),
   caseProjectionMapped:all.length-unmapped.length,caseProjectionUnmapped:unmapped.length,
   formTokensDeclared:all.filter((x:any)=>x.forms.some((f:any)=>f.token)).length,
   riskChecks:RISK_CATALOG.length,riskChecksMissingRequiredFeatures:RISK_CATALOG.filter(r=>!r.required_features?.length).length},
  officialEformParity:"not_verified" as const,legalApprovalInferred:false as const,
  total:selection.length,offset,limit,nextOffset:offset+page.length<selection.length?offset+page.length:null,fields:page};
}
/** Case-scoped check. Identical canonical keys from another applicant, another
 * document, another page or another month cannot clear a reviewed obligation.
 * This adds source precision to the existing document requirement workflow;
 * it never turns 693 catalog fields into mandatory fields for every case.
 */
export function evaluateCaseFieldLineage(data:CaseData,rows:ReadonlyArray<{
 canonicalFieldId:string;datatype?:string;temporalRole?:string;sourceRequirements:{periodIdentity:boolean}
}>,input:{limit?:number;offset?:number}={}){
 const sourceIndex=createCaseReadIndex(data),facts=currentFacts(data,sourceIndex),byId=new Map<string,typeof facts>();
 for(const fact of facts){
   const id=fact.canonicalFieldId??fact.fieldObservation?.canonicalFieldId;
   if(id)byId.set(id,[...(byId.get(id)??[]),fact]);
 }
 const requirements=(data.workflowState?.requirements??[]).filter(r=>!r.retired&&!r.waivedByReview&&!r.notApplicableConfirmed);
 const required=new Map<string,typeof requirements>();
 for(const requirement of requirements){
   if(requirement.mappingRequired||!requirement.crosswalkReview)continue;
   for(const group of requirement.requiredFieldGroups??[])for(const id of group)
     required.set(id,[...(required.get(id)??[]),requirement]);
 }
 const dateOK=(text:string)=>{const d=new Date(text+"T00:00:00.000Z");return /^\d{4}-\d{2}-\d{2}$/.test(text)&&!Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===text;};
 const monthIndex=(date:string)=>{const d=new Date(date+"T00:00:00.000Z");return d.getUTCFullYear()*12+d.getUTCMonth();};
 const monthScope=(requirement:typeof requirements[number]):{start:number;end:number}|null=>{
   const parts=String(requirement.requiredPeriod??"").match(/(\d{4}-\d{2}-\d{2})\s*(?:~|～|–|—|\.\.|\bto\b|\s+-\s+)\s*(\d{4}-\d{2}-\d{2})/i);
   if(!parts||!dateOK(parts[1])||!dateOK(parts[2]))return null;
   const start=monthIndex(parts[1]),end=monthIndex(parts[2]);
   return start<=end&&end-start<120?{start,end}:null;
 };
 const referenced=(fact:typeof facts[number],requirement:typeof requirements[number])=>fact.refs.some(ref=>{
   const doc=data.documents.find(d=>d.id===ref.documentId&&d.status==="active");
   if(!doc||doc.sha256!==ref.sourceHash||!validSourceRef(data,ref,sourceIndex))return false;
   const matches=(data.workflowState?.documentMatches??[]).filter(m=>
     m.requirementId===requirement.requirementId&&m.subjectLinkId===requirement.subjectLinkId
       &&m.state==="accepted"&&m.sourceDocumentHash===doc.sha256&&m.documentId===doc.id);
   return matches.some(m=>m.pageIds.includes(ref.documentId+":"+ref.page));
 });
 const sourceValid=(fact:typeof facts[number])=>fact.state==="verified"&&fact.recognition==="accepted"&&
   fact.fieldObservation?.sourceState==="present"&&
   !fact.validation.some(v=>v.severity!=="info")&&
   !factSourceLineageIssues(data,[fact.id],sourceIndex).some(code=>
     ["STALE_OR_RETRACTED_FACT","DISPUTED_OR_REJECTED_FACT","SOURCE_REFERENCE_INVALID","SOURCE_VERIFICATION_RECEIPT_INVALID"].includes(code));
 const periodPresent=(fact:typeof facts[number],row:typeof rows[number])=>{
   if(fact.periodStart||fact.periodEnd||fact.asOf)return true;
   const v=String(fact.value??"");
   return ["date","datetime","period"].includes(row.datatype??"")&&/^\d{4}-\d{2}-\d{2}/.test(v)
     ||(row.temporalRole??"").includes("year")&&/^\d{4}$/.test(v);
 };
 const monthCoverage=(facts:typeof sourceIndex.current,scope:{start:number;end:number})=>{
   const observed=new Set<number>();
   for(const fact of facts){
     const from=fact.periodStart,to=fact.periodEnd;
     if(!from||!to||!dateOK(from)||!dateOK(to))continue;
     const first=new Date(from+"T00:00:00.000Z"),last=new Date(to+"T00:00:00.000Z");
     if(first.getUTCDate()!==1||last.getUTCDate()!==new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth()+1,0)).getUTCDate())continue;
     const start=monthIndex(from),end=monthIndex(to);
     if(end<start||end-start>120)continue;
     for(let month=Math.max(start,scope.start);month<=Math.min(end,scope.end);month++)observed.add(month);
   }
   return observed.size;
 };
 const result=rows.map(row=>{
   const all=byId.get(row.canonicalFieldId)??[],need=required.get(row.canonicalFieldId)??[];
   const blockers=new Set<string>(),scoped=new Set<typeof facts[number]>(),accepted=new Set<typeof facts[number]>();
   for(const req of need){
     const current=all.filter(fact=>referenced(fact,req)),usable=current.filter(sourceValid);
     current.forEach(fact=>scoped.add(fact));usable.forEach(fact=>accepted.add(fact));
     if(!all.length)blockers.add("REQUIRED_CANONICAL_FIELD_NOT_OBSERVED");
     else if(!current.length)blockers.add("REQUIRED_FIELD_WRONG_SOURCE_SCOPE_OR_NO_ACCEPTED_MATCH");
     else if(!usable.length)blockers.add("REQUIRED_FIELD_NOT_SOURCE_VERIFIED_AND_LEGALLY_REVIEWED");
     if(current.some(f=>f.state==="disputed"||f.fieldObservation?.sourceState==="conflicting"))blockers.add("REQUIRED_FIELD_CONFLICT");
     if(row.sourceRequirements.periodIdentity&&usable.some(f=>!periodPresent(f,row)))
       blockers.add("REQUIRED_FIELD_PERIOD_UNSCOPED");
     if(req.crosswalkReview?.periodPolicy?.toLowerCase().includes("monthly")){
       const range=monthScope(req);
       if(!range)blockers.add("REQUIRED_MONTHLY_PERIOD_SCOPE_REVIEW");
       else if(monthCoverage(usable,range)<range.end-range.start+1)
         blockers.add("REQUIRED_MONTHLY_FIELD_COVERAGE_INCOMPLETE");
     }
   }
   return {canonicalFieldId:row.canonicalFieldId,sourceObservations:all.length,
     acceptedVerifiedFacts:accepted.size,currentReviewedRequirementIds:distinct(need.map(x=>x.requirementId)),
     matchedSourceFacts:scoped.size,blockerCandidates:[...blockers].sort(),
     state:blockers.size?"required_review_blocked":accepted.size?"reviewed_source":all.length?"source_review_pending":"not_observed_unknown"};
 });
 const limit=input.limit??100,offset=input.offset??0;
 if(!Number.isSafeInteger(limit)||limit<1||limit>1000||!Number.isSafeInteger(offset)||offset<0)throw new Error("INVALID_CASE_LINEAGE_PAGE");
 const page=result.slice(offset,offset+limit);
 return {schemaVersion:"case-feature-lineage/2",caseId:data.context.id,caseRevision:data.context.revision,
  summary:{catalogFields:rows.length,sourceObserved:result.filter(x=>x.sourceObservations).length,
   requiredFieldIds:required.size,requiredBlocked:result.filter(x=>x.blockerCandidates.length).length,
   unreviewedRequirementMappings:requirements.filter(r=>r.mappingRequired||!r.crosswalkReview).length},
  currentRequirednessOnly:true,legalApprovalInferred:false,finalizeAllowedInferred:false,
  offset,limit,nextOffset:offset+page.length<result.length?offset+page.length:null,fields:page};
}
export function auditLegalRiskContracts(){
 const unchecked=RISK_CATALOG.filter(x=>!x.required_features?.length).map(x=>({id:x.id,title:x.title,issue:"MISSING_REQUIRED_FEATURE_CONTRACT",reviewRequired:true}));
 return {schemaVersion:"legal-risk-feature-audit/1",riskChecks:RISK_CATALOG.length,featurelessRiskChecks:unchecked.length,
  declaredFeatureKeys:distinct(RISK_CATALOG.flatMap(x=>x.required_features??[])),unchecked,automaticLegalApproval:false};
}
export function auditCourtPracticeGaps(){
 return {schemaVersion:"court-practice-gap-audit/1",sources:practice.sources,gaps:practice.gaps,
  officialEformParity:"not_verified",caseLawApplicability:"review_required",automaticCourtApproval:false};
}
