/** Read-only compatibility audit for business financial OCR → CaseData → 18
 * calculator specs → D5103/D5110 form mappings. Does not inspect live D1 data.
 */
import ids from "./canonical-field-id-index.json" with {type:"json"};
import {BUSINESS_SOURCE_MONEY_ROLES,BUSINESS_SOURCE_PERIOD_FIELDS} from "./business-source-evidence.ts";
import {sharedDocumentFieldContract} from "./shared-document-catalog.ts";
import {bindCanonicalSourceField,canonicalProjectionKey} from "./canonical-field-binding.ts";
import {getCalculationSpecs} from "./execution-catalog.ts";
export const BUSINESS_SCHEMA_AUDIT_VERSION="business-source-typed-form-compatibility/1";
export function businessSchemaIntegrityAudit(){
 const registry=new Set<string>(ids.ids),issues:string[]=[];
 const money=Object.keys(BUSINESS_SOURCE_MONEY_ROLES),
  periods=Object.values(BUSINESS_SOURCE_PERIOD_FIELDS).flat();
 const check=(id:string,expected:"money"|"date")=>{
  if(!registry.has(id)){issues.push("CANONICAL_ID_NOT_REGISTERED:"+id);return;}
  const family=id.split("::")[0],doc=family==="business_sales_vat"?"vat_certificate":"business_income_report";
  const contract=sharedDocumentFieldContract(doc,family);
  if(!contract){issues.push("BUSINESS_DOCUMENT_FAMILY_MISSING:"+id);return;}
  const fields=contract.fields.filter(f=>f.global_field_id===id);
  if(fields.length!==1){issues.push("FAMILY_FIELD_NOT_UNIQUE:"+id);return;}
  const def=fields[0];
  if(expected==="money"&&(!def.datatype.startsWith("money")||def.canonical_unit!=="KRW"))
    issues.push("BUSINESS_MONEY_FORMAT_MISMATCH:"+id);
  if(expected==="date"&&def.datatype!=="date")issues.push("BUSINESS_DATE_FORMAT_MISMATCH:"+id);
  const binding=bindCanonicalSourceField({key:def.local_id,canonicalFieldId:id},contract);
  if(binding.canonicalFieldId!==id)issues.push("CANONICAL_BINDING_DRIFT:"+id);
  if(family==="business_costs_and_ledgers"&&canonicalProjectionKey(contract,binding,"income")!==null)
    issues.push("UNREVIEWED_RAW_BUSINESS_COST_TYPED_PROJECTION:"+id);
 };
 money.forEach(id=>check(id,"money"));
 periods.forEach(id=>check(id,"date"));
 const current=sharedDocumentFieldContract("business_income_report","business_current_income_summary");
 if(current?.fields.find(f=>f.global_field_id==="business_current_income_summary::income.self_employment.net_receipt")?.temporal_role!=="event_date")
   issues.push("CASH_RECEIPT_EVENT_DATE_SEMANTICS_DRIFT");
 if(BUSINESS_SOURCE_MONEY_ROLES["business_costs_and_ledgers::income.business_cost.tax_component"]!=="input_vat")
   issues.push("PURCHASE_INPUT_VAT_IS_NOT_COLLECTED_SALES_VAT");
 const specs=getCalculationSpecs();
 const required:Readonly<Record<string,readonly string[]>>={
  income_average:["income.gross","income.expenses","income.net","income.amountBasis","income.periodStart","income.periodEnd"],
  income_aggregation:["income.payerIdentityId","income.aggregationTreatment","context.filingPeriod","context.inventoryComplete.income"],
  ordinary_budget:["context.monthlyTrusteeFee","context.monthlyPriorityPayment","context.monthlyEstatePayment","context.approvedMonthlyPayment"],
  form_projection:["asset.kind","income.kind","context.monthlyTrusteeFee","context.planMonths"]
 };
 for(const [id,keys] of Object.entries(required)){
  const calc=specs.find(x=>x.id===id);
  if(!calc){issues.push("CALCULATION_MODULE_MISSING:"+id);continue;}
  for(const key of keys)if(!calc.inputs.includes(key))issues.push("CALCULATION_INPUT_CONTRACT_MISSING:"+id+":"+key);
 }
 const form=specs.find(s=>s.id==="form_projection");
 if(!form?.formBindings.includes("scalars.monthly_business_income"))
   issues.push("BUSINESS_MONTHLY_FORM_OUTPUT_CONTRACT_MISSING");
 return {schemaVersion:BUSINESS_SCHEMA_AUDIT_VERSION,
   registeredCanonicalFields:registry.size,businessMoneyFields:money.length,
   periodBoundaryFields:periods.length,
   registeredCalculations:specs.length,registeredCalculationInputSlots:specs.reduce((n,c)=>n+c.inputs.length,0),
   validatedSourceConsumers:money.length+periods.length,
   issues:[...new Set(issues)].sort(),compatibleStaticContracts:issues.length===0,
   physicalD1RowsInspected:false,caseFactsInspected:false,
   courtOfficialFormFieldsVerified:false,legalApprovalInferred:false};
}
