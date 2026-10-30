/** P0-07: editable 95-check evidence contracts, NO inferred statutory requiredness.
 * Unmapped items remain lawyer-review requirements, never an AI pass.
 * The 95 source check IDs are governed by the legacy risk catalog but only
 * human-reviewed mapping rows can connect precise canonical OCR evidence.
 */
import riskCatalog from "./risk-catalog.json" with {type:"json"};
import sourceFamilies from "./document-agent-field-contracts.json" with {type:"json"};
import sharedFields from "./shared-document-field-contracts.json" with {type:"json"};
import supplements from "./ocr-field-supplements.json" with {type:"json"};
import {readReferenceValue} from "./reference-runtime.ts";
export const LEGAL_EVIDENCE_POLICY_REFERENCE_ID="policy.legal_review.evidence_contracts";
export type LegalEvidenceGroup=string[];
export interface LegalEvidenceCriterion {
 checkId:string;reviewStatus:"approved_for_evidence_routing";
 requiredCanonicalFieldGroups:LegalEvidenceGroup[];
 requiredCalculationOutputs:string[];
 sourceUrls:string[];courtIds:string[];
 effectiveFrom:string|null;effectiveTo:string|null;
 reason:string;
}
export interface LegalEvidencePolicy {
 schemaVersion:"legal-risk-evidence-contracts/1";checks:LegalEvidenceCriterion[];
}
export const LEGAL_EVIDENCE_POLICY_SEED:LegalEvidencePolicy={schemaVersion:"legal-risk-evidence-contracts/1",checks:[]};
const known=new Set((riskCatalog.entries as {id:string}[]).map(item=>item.id));
const ids=new Set<string>();
for(const family of Object.values(sourceFamilies.families))for(const field of family.fields)ids.add(field.global_field_id);
for(const document of Object.values(sharedFields.documents))
 for(const fields of Object.values(document.fieldsByFamily))for(const field of fields)ids.add(field.global_field_id);
for(const doc of Object.values(supplements.documents))for(const fields of Object.values(doc))for(const field of fields)ids.add(field.global_field_id);
const record=(value:unknown):value is Record<string,any>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const official=(raw:string)=>{try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password&&(u.hostname==="law.go.kr"||u.hostname.endsWith(".go.kr")||u.hostname.endsWith(".scourt.go.kr"));}catch{return false;}};
export function validateLegalEvidencePolicy(value:unknown):asserts value is LegalEvidencePolicy{
 if(!record(value)||Object.keys(value).sort().join(",")!=="checks,schemaVersion"||value.schemaVersion!=="legal-risk-evidence-contracts/1"||!Array.isArray(value.checks)||value.checks.length>known.size)throw Error("INVALID_LEGAL_EVIDENCE_POLICY");
 const seen=new Set<string>(),keys=["checkId","reviewStatus","requiredCanonicalFieldGroups","requiredCalculationOutputs","sourceUrls","courtIds","effectiveFrom","effectiveTo","reason"].sort().join(",");
 for(const v of value.checks){
  if(!record(v)||Object.keys(v).sort().join(",")!==keys||typeof v.checkId!=="string"||!known.has(v.checkId)||seen.has(v.checkId)
    ||v.reviewStatus!=="approved_for_evidence_routing"||typeof v.reason!=="string"||v.reason.trim().length<12||v.reason.length>3000
    ||!Array.isArray(v.requiredCanonicalFieldGroups)||v.requiredCanonicalFieldGroups.length>25
    ||!v.requiredCanonicalFieldGroups.every((g:unknown)=>Array.isArray(g)&&g.length>0&&g.length<=12&&g.every((id:unknown)=>typeof id==="string"&&ids.has(id))&&new Set(g).size===g.length)
    ||!Array.isArray(v.requiredCalculationOutputs)||v.requiredCalculationOutputs.length>32||v.requiredCalculationOutputs.some((x:unknown)=>typeof x!=="string"||!/^[a-zA-Z][a-zA-Z0-9]{1,100}$/.test(x))
    ||new Set(v.requiredCalculationOutputs).size!==v.requiredCalculationOutputs.length
    ||(!v.requiredCanonicalFieldGroups.length&&!v.requiredCalculationOutputs.length)
    ||!Array.isArray(v.sourceUrls)||v.sourceUrls.length<1||v.sourceUrls.length>12||v.sourceUrls.some((u:unknown)=>typeof u!=="string"||!official(u))
    ||!Array.isArray(v.courtIds)||v.courtIds.length<1||v.courtIds.length>15||v.courtIds.some((id:unknown)=>typeof id!=="string"||!/^[a-z0-9_-]{2,80}$/.test(id))
    ||v.effectiveFrom!==null&&(typeof v.effectiveFrom!=="string"||!date(v.effectiveFrom))
    ||v.effectiveTo!==null&&(typeof v.effectiveTo!=="string"||!date(v.effectiveTo))
    ||v.effectiveFrom&&v.effectiveTo&&v.effectiveTo<v.effectiveFrom)throw Error("INVALID_LEGAL_EVIDENCE_CONTRACT:"+String(v?.checkId??"unknown"));
  seen.add(v.checkId);
 }
}
export function activeLegalEvidencePolicy():LegalEvidencePolicy{
 const policy=readReferenceValue<LegalEvidencePolicy>(LEGAL_EVIDENCE_POLICY_REFERENCE_ID,LEGAL_EVIDENCE_POLICY_SEED);
 validateLegalEvidencePolicy(policy);return policy;
}
export function legalEvidenceCriterion(checkId:string,courtId?:string,applicationDate?:string){
 const value=activeLegalEvidencePolicy().checks.find(row=>row.checkId===checkId);
 if(!value)return {checkId,status:"unmapped" as const,requiredCanonicalFieldGroups:[] as string[][],
    requiredCalculationOutputs:[] as string[],sourceUrls:[] as string[]};
 if(!courtId||!value.courtIds.includes(courtId)||!applicationDate||!date(applicationDate)||
     value.effectiveFrom&&applicationDate<value.effectiveFrom||value.effectiveTo&&applicationDate>value.effectiveTo)
   return {checkId,status:"outside_or_unresolved_applicability" as const,requiredCanonicalFieldGroups:[] as string[][],
    requiredCalculationOutputs:[] as string[],sourceUrls:value.sourceUrls};
 return {checkId,status:"approved_evidence_route" as const,
  requiredCanonicalFieldGroups:value.requiredCanonicalFieldGroups,requiredCalculationOutputs:value.requiredCalculationOutputs,
  sourceUrls:value.sourceUrls};
}
export function legalEvidenceInventory(courtId?:string,applicationDate?:string){
 return (riskCatalog.entries as {id:string;title:string;required_features:string[]}[]).map(r=>{
  const c=legalEvidenceCriterion(r.id,courtId,applicationDate);
  return {...c,title:r.title,legacyFactKeyCandidates:[...r.required_features],noAutomaticLegalApproval:true};
 });
}
