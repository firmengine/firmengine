/** Staff-managed court substitution contract. Document types and OCR values
 * never confer a legal waiver without an approved source-bound route.
 */
import seed from "./substitution-policy.json" with { type: "json" };
import { readReferenceValue } from "./reference-runtime.ts";

export const SUBSTITUTION_POLICY_REFERENCE_ID = "policy.substitution.court_routes";
export interface PublishedSubstitutionRoute {
  id:string; courtId:string; sourceId:string; sourceUrl:string;
  originalDocumentTypeId:string; alternativeDocumentTypeIds:string[];
  minimumCalendarMonths:number; employerSignatureRequired:boolean;
  exceptionReasonRequired:boolean; effectiveFrom:string|null; effectiveTo:string|null;
  authorityStatus:"reviewed_official_route_case_proof_required";
}
export interface SubstitutionPolicy {
  schemaVersion:"court-substitution-criteria/1"; routes:PublishedSubstitutionRoute[];
}
export const SUBSTITUTION_POLICY_SEED:SubstitutionPolicy = seed as SubstitutionPolicy;
const isRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const date=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T00:00:00Z"))&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
const id=(value:unknown)=>typeof value==="string"&&/^[a-zA-Z0-9_.:-]{2,160}$/.test(value);
const official=(raw:string)=>{try{const url=new URL(raw);return url.protocol==="https:"&&!url.username&&!url.password&&(url.hostname==="law.go.kr"||url.hostname.endsWith(".go.kr")||url.hostname.endsWith(".scourt.go.kr"));}catch{return false;}};
export function validateSubstitutionPolicy(value:unknown):asserts value is SubstitutionPolicy {
  if(!isRecord(value)||Object.keys(value).sort().join(",")!=="routes,schemaVersion"||value.schemaVersion!=="court-substitution-criteria/1"||!Array.isArray(value.routes)||!value.routes.length||value.routes.length>512)throw new Error("INVALID_SUBSTITUTION_POLICY");
  const ids=new Set<string>(),pairs=new Set<string>(),routeKeys=["id","courtId","sourceId","sourceUrl","originalDocumentTypeId","alternativeDocumentTypeIds","minimumCalendarMonths","employerSignatureRequired","exceptionReasonRequired","effectiveFrom","effectiveTo","authorityStatus"].sort().join(",");
  for(const candidate of value.routes){
    if(!isRecord(candidate)||Object.keys(candidate).sort().join(",")!==routeKeys)throw new Error("INVALID_SUBSTITUTION_ROUTE_SHAPE");
    const route=candidate as Record<string,any>;
    if(!id(route.id)||ids.has(route.id)||!id(route.courtId)||!id(route.sourceId)||!id(route.originalDocumentTypeId)
      ||typeof route.sourceUrl!=="string"||!official(route.sourceUrl)||!Array.isArray(route.alternativeDocumentTypeIds)
      ||route.alternativeDocumentTypeIds.length<1||route.alternativeDocumentTypeIds.length>8
      ||route.alternativeDocumentTypeIds.some((v:unknown)=>!id(v))||new Set(route.alternativeDocumentTypeIds).size!==route.alternativeDocumentTypeIds.length
      ||route.alternativeDocumentTypeIds.includes(route.originalDocumentTypeId)
      ||!Number.isSafeInteger(route.minimumCalendarMonths)||route.minimumCalendarMonths<0||route.minimumCalendarMonths>120
      ||typeof route.employerSignatureRequired!=="boolean"||typeof route.exceptionReasonRequired!=="boolean"
      ||route.authorityStatus!=="reviewed_official_route_case_proof_required"
      ||route.effectiveFrom!==null&&(typeof route.effectiveFrom!=="string"||!date(route.effectiveFrom))
      ||route.effectiveTo!==null&&(typeof route.effectiveTo!=="string"||!date(route.effectiveTo))
      ||route.effectiveFrom&&route.effectiveTo&&route.effectiveTo<route.effectiveFrom)throw new Error("INVALID_SUBSTITUTION_ROUTE");
    const key=JSON.stringify([route.courtId,route.originalDocumentTypeId,[...route.alternativeDocumentTypeIds].sort()]);
    if(pairs.has(key))throw new Error("DUPLICATE_SUBSTITUTION_ROUTE");
    ids.add(route.id);pairs.add(key);
  }
}
export function activeSubstitutionPolicy():SubstitutionPolicy {
  const value=readReferenceValue<SubstitutionPolicy>(SUBSTITUTION_POLICY_REFERENCE_ID,SUBSTITUTION_POLICY_SEED);
  validateSubstitutionPolicy(value);return value;
}
export function matchPublishedSubstitutionRoute(input:{
  policy:SubstitutionPolicy;courtId:string;applicationDate:string;sourceIds:readonly string[];
  originalDocumentTypeId:string;alternativeDocumentTypeIds:readonly string[];
  periodStart:string;periodEnd:string;employerSigned:boolean;exceptionReason:string;
}):PublishedSubstitutionRoute|null {
  validateSubstitutionPolicy(input.policy);
  if(!date(input.applicationDate)||!date(input.periodStart)||!date(input.periodEnd)||input.periodEnd<input.periodStart)return null;
  const sorted=(items:readonly string[])=>JSON.stringify([...items].sort());
  if(!input.alternativeDocumentTypeIds.length||new Set(input.alternativeDocumentTypeIds).size!==input.alternativeDocumentTypeIds.length)return null;
  const selected=sorted(input.alternativeDocumentTypeIds);
  const start=new Date(input.periodStart+"T00:00:00Z"),end=new Date(input.periodEnd+"T00:00:00Z");
  const count=(end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth()+1;
  return input.policy.routes.find(route=>route.courtId===input.courtId
    &&route.originalDocumentTypeId===input.originalDocumentTypeId
    &&sorted(route.alternativeDocumentTypeIds)===selected
    &&input.sourceIds.includes(route.sourceId)
    &&(!route.effectiveFrom||input.applicationDate>=route.effectiveFrom)
    &&(!route.effectiveTo||input.applicationDate<=route.effectiveTo)
    &&(!route.exceptionReasonRequired||input.exceptionReason.trim().length>=10)
    &&(!route.employerSignatureRequired||input.employerSigned)
    &&count>=route.minimumCalendarMonths)??null;
}
