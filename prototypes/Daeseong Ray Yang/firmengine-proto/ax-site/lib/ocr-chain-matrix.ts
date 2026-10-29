/** Read-only 85-document OCR -> DB -> case -> form/calculation crosswalk.
 * A form candidate is NOT a verified official e-form requirement.
 */
import type { IntakeCatalog } from "./intake-types.ts";
import { buildSharedDocumentCatalog,sharedDocumentFieldContract } from "./shared-document-catalog.ts";
import { bindCanonicalSourceField,canonicalProjectionKey } from "./canonical-field-binding.ts";
export const OCR_CHAIN_MATRIX_VERSION="ocr-db-form-calculation-matrix/1" as const;
const categories=["person","income","debt","asset","transaction","household","business","statement","other"] as const;
const targets:Record<string,{forms:string[];calculation:string|null}>={
 "identity_residence_record::identity.name":{forms:["D5100.client_name"],calculation:null},
 "identity_residence_record::identity.address":{forms:["D5100.address"],calculation:null},
 "identity_residence_record::identity.registration_id":{forms:["D5100.resident_id"],calculation:null},
 "payroll_payslip::income.payroll.net_pay":{forms:["D5103.month.net_income","D5110.approved_monthly_income"],calculation:"monthlyIncomeWon_reviewed_group"},
 "salary_statement::gross_total":{forms:["D5103.month.revenue"],calculation:"monthlyIncomeWon_reviewed_group"},
 "debt_certificate::creditor":{forms:["D5106.creditor.entity"],calculation:null},
 "debt_certificate::creditor_address":{forms:["D5106.creditor.address"],calculation:null},
 "debt_certificate::claim_cause":{forms:["D5106.creditor.cause"],calculation:null},
 "debt_certificate::principal_balance":{forms:["D5106.creditor.principal"],calculation:"debtPrincipalWon"},
 "debt_certificate::interest_balance":{forms:["D5106.creditor.interest"],calculation:"debtInterestWon"},
 "cash_deposit_asset::gross_value":{forms:["D5101.asset.value","D5110.liquidation_value"],calculation:"liquidationValueWon_reviewed_asset"},
 "insurance_policy_asset::surrender_value":{forms:["D5101.asset.value","D5110.liquidation_value"],calculation:"liquidationValueWon_reviewed_asset"}
};
export function buildOcrChainMatrix(catalog:IntakeCatalog,sha256:string,input:{documentTypeId?:string;limit?:number;offset?:number}={}){
 const source=buildSharedDocumentCatalog(catalog,sha256);
 const selected=catalog.documents.filter(doc=>!input.documentTypeId||doc.id===input.documentTypeId);
 const limit=input.limit??10,offset=input.offset??0;
 if(!Number.isSafeInteger(limit)||limit<1||limit>85||!Number.isSafeInteger(offset)||offset<0)throw new Error("INVALID_OCR_CHAIN_MATRIX_CURSOR");
 const documents=selected.slice(offset,offset+limit).map(doc=>{
   const publicEntry=source.documents.find(item=>item.documentTypeId===doc.id)!;
   const routes=publicEntry.fieldContracts.map(route=>{
     const contract=sharedDocumentFieldContract(doc.id,route.familyId);
     if(!contract)throw new Error("MISSING_OCR_FAMILY_CONTRACT");
     const fields=contract.fields.map(f=>{
       const bound=bindCanonicalSourceField({key:f.local_id,canonicalFieldId:f.global_field_id},contract);
       if(bound.canonicalFieldId!==f.global_field_id)throw new Error("CANONICAL_SCHEMA_FIELD_ID_MISMATCH");
       const typed=categories.flatMap(category=>{
         const projectionKey=canonicalProjectionKey(contract,bound,category);
         return projectionKey?[{recordCategory:category,projectionKey,caseDataPath:category+"."+projectionKey}]:[];
       });
       const target=targets[f.global_field_id]??{forms:[],calculation:null};
       return {canonicalFieldId:f.global_field_id,ocrKey:f.local_id,dbColumn:"extracted_features.canonical_field_id",
         rawValueColumn:"extracted_features.raw_value_json",sourceStateColumn:"extracted_features.source_state",
         datatype:f.datatype,unit:f.canonical_unit,temporalRole:f.temporal_role,
         typedProjection:typed,formCandidates:target.forms,calculationCandidate:target.calculation,
         legalRequiredness:"not_inferred_from_ocr" as const};
     });
     return {familyId:route.familyId,fieldCount:fields.length,fields};
   });
   return {documentTypeId:doc.id,documentName:doc.name,sourceMasterLabels:doc.fields,
     sourceMasterMatching:"staff_review_required" as const,routingStatus:publicEntry.routingStatus,
     collectionMode:publicEntry.collectionMode,
     recordPolicy:"separate record per entity/item/month/transaction; never flatten repeats" as const,routes};
 });
 return {schemaVersion:OCR_CHAIN_MATRIX_VERSION,catalogVersion:catalog.version,catalogSha256:sha256,
  totalDocuments:source.documents.length,filteredDocuments:selected.length,offset,limit,
  nextOffset:offset+documents.length<selected.length?offset+documents.length:null,
  notObservedMeaning:"page-level unknown, not absent/zero/not-applicable",
  officialEformParity:"unverified" as const,legalCalculationApproval:false as const,documents};
}
