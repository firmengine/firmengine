/** Evidence-only candidate register. A business name or masked identifier cannot
 * prove that two document rows belong to the same legal entity. This module
 * never sets an applicant income, cross-document identity or court decision.
 */
import {createCaseReadIndex,currentFacts,factSourceLineageIssues,type CaseData,type CaseReadIndex,type Fact} from "./domain.ts";
import {BUSINESS_SOURCE_MONEY_ROLES} from "./business-source-evidence.ts";

export const BUSINESS_IDENTITY_CROSSWALK_VERSION="business-identity-evidence/1";
const REG="business_registration::";
const OWNER_FIELDS:Readonly<Record<string,string>>={
  business_sales_vat:"business_sales_vat::income.sales.business_entity",
  business_costs_and_ledgers:"business_costs_and_ledgers::income.business_cost.business_entity",
  business_current_income_summary:"business_current_income_summary::income.self_employment.operator"
};
const valid=(data:CaseData,f:Fact,index:CaseReadIndex)=>
  f.state==="verified"&&f.recognition==="accepted"&&
  f.validation.every(e=>e.severity!=="error")&&
  (!f.fieldObservation||f.fieldObservation.sourceState==="present")&&
  factSourceLineageIssues(data,[f.id],index).length===0;
const key=(f:Fact)=>f.canonicalFieldId??f.fieldObservation?.canonicalFieldId??"";
const textValue=(value:unknown):string|null=>typeof value==="string"&&value.trim()?value.trim():null;
interface BusinessRegistrationEvidence{
  sourceRecordId:string;registrationFactId:string;
  businessIdObserved:string|null;businessEntityFactIds:string[];representativeFactIds:string[];
  verifiedSource:boolean;reviewOnly:true;
}
export interface BusinessSourceIdentityRow {
  sourceRecordId:string;family:string;
  amountFactIds:string[];ownerFactIds:string[];ownerNameObserved:string|null;
  ownerEvidenceVerified:boolean;registrationFactId:string|null;
  identityStatus:"unverified_cross_document_identity";
  reviewAction:"connect_to_registration_by_staff_with_source_evidence";
}
export function businessIdentityCrosswalk(data:CaseData,index:CaseReadIndex=createCaseReadIndex(data)){
 if(index.owner!==data)throw Error("BUSINESS_IDENTITY_WRONG_CASE");
 const facts=currentFacts(data,index);
 const bySubject=index.bySubject;
 const reg=bySubject.entries();
 const registrations:BusinessRegistrationEvidence[]=[];
 for(const [sourceRecordId,rows] of reg){
  const identifiers=rows.filter(f=>key(f)===REG+"business_id");
  if(!identifiers.length)continue;
  const entity=rows.filter(f=>key(f)===REG+"business_entity");
  const reps=rows.filter(f=>key(f)===REG+"representative");
  const one=identifiers.length===1?identifiers[0]:null;
  registrations.push({sourceRecordId,registrationFactId:one?.id??"",
   businessIdObserved:one?textValue(one.value):null,
   businessEntityFactIds:entity.map(f=>f.id),
   representativeFactIds:reps.map(f=>f.id),
   verifiedSource:!!one&&!!textValue(one.value)&&valid(data,one,index),
   reviewOnly:true});
 }
 const sourceRecords=new Map<string,{family:string;amountFactIds:string[]}>();
 const canonicalMoneyBySubject=new Set(Object.keys(OWNER_FIELDS));
 for(const f of facts){
  const canonical=key(f);
  const family=canonical.split("::")[0];
  if(!canonicalMoneyBySubject.has(family))continue;
  if(!canonical.startsWith(family+"::"))continue;
  const entry=sourceRecords.get(f.subjectId)??{family,amountFactIds:[]};
  // Record the entire source row for candidate mapping but only monetary facts
  // are selected for gross/cost cross-check by the separate business audit.
  sourceRecords.set(f.subjectId,entry);
 }
 const amountIndex=new Map<string,string[]>();
 // One exact-ID pass; no repeated paging/sorting over all OCR source records.
 for(const f of facts)if(Object.hasOwn(BUSINESS_SOURCE_MONEY_ROLES,key(f)))
  amountIndex.set(f.subjectId,[...(amountIndex.get(f.subjectId)??[]),f.id]);
 const records:BusinessSourceIdentityRow[]=[...sourceRecords].map(([sourceRecordId,item])=>{
  const related=bySubject.get(sourceRecordId)??[];
  const owners=related.filter(f=>key(f)===OWNER_FIELDS[item.family]);
  const usable=owners.length===1&&valid(data,owners[0],index)&&!!textValue(owners[0].value);
  return {sourceRecordId,family:item.family,amountFactIds:[...new Set(amountIndex.get(sourceRecordId)??[])].sort(),
   ownerFactIds:owners.map(f=>f.id),
   ownerNameObserved:usable?textValue(owners[0].value):null,
   ownerEvidenceVerified:usable,
   registrationFactId:null,
   identityStatus:"unverified_cross_document_identity" as const,
   reviewAction:"connect_to_registration_by_staff_with_source_evidence" as const};
 }).filter(row=>row.amountFactIds.length>0).sort((a,b)=>a.sourceRecordId.localeCompare(b.sourceRecordId));
 return {schemaVersion:BUSINESS_IDENTITY_CROSSWALK_VERSION,
  caseRevision:data.context.revision,
  registrationRows:registrations.sort((a,b)=>a.sourceRecordId.localeCompare(b.sourceRecordId)),
  businessSourceRows:records,
  requiredHumanCrosswalkRows:records.length,
  automaticIdentityApproval:false as const};
}
