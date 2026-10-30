/** Staff-editable, OFF by default. A source amount is never a tax deduction
 * until an official-source, court/date-scoped reference rule is approved.
 * No model, editor, or extracted document may grant recognition of its own.
 */
import {readReferenceValue,currentReferenceSnapshot} from "./reference-runtime.ts";
export const BUSINESS_INCOME_POLICY_ID="policy.business_income.monthly_reconciliation";
export const BUSINESS_INCOME_POLICY_VERSION="business-income-monthly-policy/1" as const;
export interface BusinessIncomeRule{
 id:string;courtId:string;effectiveFrom:string;effectiveTo:string|null;
 approvedCostCategories:string[];
 vatTreatment:"gross_and_costs_as_source_stated_after_human_vat_review";
 sourceUrls:string[];reason:string;
}
export interface BusinessIncomePolicy{
 schemaVersion:typeof BUSINESS_INCOME_POLICY_VERSION;
 rules:BusinessIncomeRule[];
}
export const BUSINESS_INCOME_POLICY_SEED:BusinessIncomePolicy={
 schemaVersion:BUSINESS_INCOME_POLICY_VERSION,rules:[]
};
const validDate=(s:unknown):s is string=>{
 if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+"T00:00:00.000Z");
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===s;
};
const official=(url:string)=>{
 try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password&&
 (u.hostname==="law.go.kr"||u.hostname.endsWith(".go.kr")||u.hostname.endsWith(".scourt.go.kr"));}
 catch{return false;}
};
export function validateBusinessIncomePolicy(value:unknown):asserts value is BusinessIncomePolicy{
 const invalid=()=>{throw Error("INVALID_BUSINESS_INCOME_POLICY");};
 if(!value||typeof value!=="object"||Array.isArray(value))invalid();
 const policy=value as Record<string,unknown>;
 if(Object.keys(policy).sort().join(",")!=="rules,schemaVersion"||
    policy.schemaVersion!==BUSINESS_INCOME_POLICY_VERSION||!Array.isArray(policy.rules)||
    policy.rules.length>100)invalid();
 const seen=new Set<string>();
 for(const raw of policy.rules){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))invalid();
  const x=raw as Record<string,unknown>;
  if(Object.keys(x).sort().join(",")!==
     ["id","courtId","effectiveFrom","effectiveTo","approvedCostCategories","vatTreatment","sourceUrls","reason"].sort().join(",")||
     typeof x.id!=="string"||!/^[A-Za-z0-9_.:-]{3,90}$/.test(x.id)||seen.has(x.id)||
     typeof x.courtId!=="string"||!/^[a-z0-9_-]{2,50}$/.test(x.courtId)||
     !validDate(x.effectiveFrom)||(x.effectiveTo!==null&&!validDate(x.effectiveTo))||
     typeof x.effectiveTo==="string"&&typeof x.effectiveFrom==="string"&&x.effectiveTo<x.effectiveFrom||
     x.vatTreatment!=="gross_and_costs_as_source_stated_after_human_vat_review"||
     !Array.isArray(x.approvedCostCategories)||x.approvedCostCategories.length<1||x.approvedCostCategories.length>40||
     x.approvedCostCategories.some((c:unknown)=>typeof c!=="string"||c.trim().length<2||c.length>100)||
     new Set(x.approvedCostCategories).size!==x.approvedCostCategories.length||
     !Array.isArray(x.sourceUrls)||x.sourceUrls.length<1||x.sourceUrls.length>12||
     x.sourceUrls.some((url:unknown)=>typeof url!=="string"||!official(url))||
     typeof x.reason!=="string"||x.reason.trim().length<20||x.reason.length>3000)invalid();
  seen.add(x.id);
 }
}
export function activeBusinessIncomePolicy():BusinessIncomePolicy{
 const value=readReferenceValue(BUSINESS_INCOME_POLICY_ID,BUSINESS_INCOME_POLICY_SEED);
 validateBusinessIncomePolicy(value);
 return value;
}
/** This only makes a reference contract eligible for HUMAN business review.
 * It never automatically approves expenses or filing/repayment documents.
 */
export function approvedBusinessIncomeRule(courtId:string,applicationDate:string){
 const snapshot=currentReferenceSnapshot(),meta=snapshot?.metadata?.[BUSINESS_INCOME_POLICY_ID];
 if(!snapshot||!meta||meta.basisType!=="official_source"||
    !meta.reviewedBy?.trim()||!meta.reason?.trim()||
    snapshot.bundleReview?.status!=="verified"||!validDate(applicationDate))
   return null;
 const eligible=activeBusinessIncomePolicy().rules.filter(rule=>
   rule.courtId===courtId&&rule.effectiveFrom<=applicationDate&&
   (rule.effectiveTo===null||rule.effectiveTo>=applicationDate));
 return eligible.length===1?{rule:eligible[0],referenceSha256:snapshot.sha256,referenceRevision:snapshot.revision}:null;
}
