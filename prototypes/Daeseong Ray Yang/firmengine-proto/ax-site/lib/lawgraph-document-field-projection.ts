/** Source-to-calculation-to-form lineage for a persisted legal-review version.
 * Never guesses provenance from visual similarity. Unknown sources stay
 * review-required but the exact rendered draft value is still recorded.
 */
import {FORM_CONTRACTS} from "./form-contracts.ts";
import {BASIC_FORM_CODES,type FormBindings} from "./form-mapping.ts";
import {currentFacts,requiredKindsForCase,type CaseData} from "./domain.ts";
import type {StoredDocumentField} from "./case-lawgraph-store.ts";
export const LAWGRAPH_DOCUMENT_FIELD_VERSION="legal-review-form-field-lineage/1" as const;
export interface CalculationFieldRow{
 id:string;outputName:string;subjectId:string|null;rowOrdinal:number|null;
 value:unknown;status:string;sourceFactIds:string[];
}
export interface DocumentBindingInput{
 data:CaseData;bindings:FormBindings;calculationRows:readonly CalculationFieldRow[];
 calculation:{
  incomeRows:{id:string}[];debtRows:{id:string}[];assetRows:{id:string}[];
 };
}
const sourceNumeric=(x:unknown)=>typeof x==="string"?x.replace(/[,\s₩원]/g,""):typeof x==="number"?String(x):null;
const sameValue=(a:unknown,b:unknown)=>a===b||
  (sourceNumeric(a)!==null&&sourceNumeric(a)===sourceNumeric(b));
const outputByToken:Record<string,string>={
 total_principal:"debtPrincipalWon",total_interest:"debtInterestWon",
 secured_debt_total:"securedDebtWon",unsecured_debt_total:"unsecuredDebtWon",
 monthly_income:"monthlyIncomeWon",recognized_living_cost:"recognizedLivingCostWon",
 monthly_disposable_income:"disposableIncomeWon",ordinary_repayment_budget:"ordinaryRepaymentBudgetWon",
 monthly_payment:"monthlyPaymentWon",total_repayment:"planTotalWon",
 liquidation_value:"liquidationValueWon",present_value:"presentValueWon",
 "creditor.principal":"debtRows.principalWon","creditor.interest":"debtRows.interestWon",
 "creditor.total_payment":"allocations.totalWon","month.net_income":"incomeRows.monthlyWon",
 "asset.applicant_share_value":"assetRows.liquidationWon"
};
const contextByToken:Record<string,string>={
 client_name:"applicant.name",address:"applicant.address",court_name:"courtId",
 application_date:"applicationDate",debt_as_of:"asOf",repayment_months:"planMonths",
 monthly_trustee_fee:"monthlyTrusteeFee",present_value_basis:"presentValueBasis"
};
const missing=(x:unknown)=>x===undefined||x===null||String(x).trim()===""||/^\[(?:확인|누락|상충|판독|미확정|검토|불일치)/.test(String(x));
export function projectLawgraphDocumentFields(input:DocumentBindingInput):StoredDocumentField[]{
 const {data,bindings,calculationRows}=input,facts=currentFacts(data);
 const subjectIds:Record<string,string[]>={
  creditor:input.calculation.debtRows.map(r=>r.id),
  asset:input.calculation.assetRows.map(r=>r.id),
  month:input.calculation.incomeRows.map(r=>r.id),
  attachment:data.documents.filter(d=>d.status==="active").map(d=>d.id)
 };
 const result:StoredDocumentField[]=[],forms=[...new Set(requiredKindsForCase(data).map(kind=>BASIC_FORM_CODES[kind]).filter((x):x is string=>!!x))];
 for(const code of forms){
  const contract=FORM_CONTRACTS[code];if(!contract)continue;
  const kind=requiredKindsForCase(data).find(k=>BASIC_FORM_CODES[k]===code);
  if(!kind)continue;
  for(const field of contract.fields){
   const token=field.token;
   const [group,...rest]=token.split(".");
   const rowField=rest.length>0&&contract.repeatGroups.some(r=>r.id===group);
   const records=rowField?(bindings.rows[group]??[]).map((row,ordinal)=>({value:row[rest.join(".")],ordinal})):
      [{value:bindings.scalars[token],ordinal:null as number|null}];
   for(const {value,ordinal} of records){
    const subjectId=ordinal===null?null:subjectIds[group]?.[ordinal]??null;
    const output=outputByToken[token];
    const exact=output?calculationRows.filter(r=>r.outputName===output
       &&(ordinal===null?r.rowOrdinal===null:r.rowOrdinal===ordinal)
       &&(!subjectId||!r.subjectId||r.subjectId===subjectId)
       &&["computed","provisional"].includes(r.status)&&sameValue(r.value,value)):[];
    const calcFeature=exact.length===1?exact[0]:null;
    const canonical=token.replace(/[A-Z]/g,x=>"_"+x.toLowerCase());
    // Exact source key and exact displayed value only. Unknown keys are not
    // automatically bound to other parties, periods or source documents.
    const matchingFacts=field.kind==="source"&&subjectId!==null
      ?facts.filter(f=>f.subjectId===subjectId&&(f.key===token||f.key===canonical)&&sameValue(f.numeric?.amountWon??f.value,value))
      :field.kind==="source"?facts.filter(f=>(f.key===token||f.key===canonical)&&sameValue(f.numeric?.amountWon??f.value,value)):[];
    const sourceIds=[...new Set([...(calcFeature?.sourceFactIds??[]),...matchingFacts.map(f=>f.id)])];
    const contextPath=ordinal===null?contextByToken[token]:undefined;
    const status=calcFeature?"linked_calculation":matchingFacts.length===1?"exact_source_fact":contextPath?"case_context":
      missing(value)?"missing_value":"lineage_review_required";
    result.push({formCode:code,artifactKind:kind,token,subjectId,rowOrdinal:ordinal,
     value:value??null,valueKind:field.kind,sourceFactIds:sourceIds,
     calcFeatureRefs:calcFeature?[calcFeature.id]:[],
     citation:{schemaVersion:LAWGRAPH_DOCUMENT_FIELD_VERSION,status,contextPath:contextPath??null,
      caseRevision:data.context.revision,calculationStatus:calcFeature?.status??null,
      officialEformParity:"not_verified",manualReviewRequired:status!=="linked_calculation"&&status!=="exact_source_fact"&&status!=="case_context"}});
   }
  }
 }
 if(result.length>5000)throw Error("DOCUMENT_FIELD_LINEAGE_ROW_LIMIT");
 return result;
}
export async function buildStoredLawgraphDocumentFields(database:D1Database,input:{
  caseData:CaseData;calculationRunId:string;bindings:FormBindings;
  calculation:DocumentBindingInput["calculation"]
}){
 const rows=(await database.prepare("SELECT id,output_name AS outputName,subject_id AS subjectId,row_ordinal AS rowOrdinal,value_json AS valueJson,status,source_fact_ids_json AS factIdsJson FROM case_calculation_features WHERE run_id=?")
  .bind(input.calculationRunId).all<{id:string;outputName:string;subjectId:string|null;rowOrdinal:number|null;valueJson:string;status:string;factIdsJson:string}>()).results??[];
 const normalized=rows.map(row=>({id:row.id,outputName:row.outputName,subjectId:row.subjectId,
    rowOrdinal:row.rowOrdinal,status:row.status,value:JSON.parse(row.valueJson),sourceFactIds:JSON.parse(row.factIdsJson) as string[]}));
 return projectLawgraphDocumentFields({data:input.caseData,bindings:input.bindings,
  calculationRows:normalized,calculation:input.calculation});
}
