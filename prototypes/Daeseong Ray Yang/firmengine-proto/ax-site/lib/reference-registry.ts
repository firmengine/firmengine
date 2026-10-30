import data from "./reference-data.json" with { type: "json" };
import release from "./reference-release.json" with { type: "json" };
import { readReferenceValue, currentReferenceSnapshot, freezeReferenceValue } from "./reference-runtime.ts";
import {MANAGED_REFERENCE_RECORDS} from "./managed-reference-contracts.ts";
import {SUBSTITUTION_POLICY_REFERENCE_ID,validateSubstitutionPolicy} from "./substitution-policy.ts";

export interface ReferenceConsumer { path: string; symbol: string; line?: number; jsonPointer?: string; sha256?: string; fileSha256?: string }
export interface ReferenceRecord {
  id: string; kind: string; category: string; title: string; value: unknown;
  unit?: string | null; sourceIds: string[]; sourceUrls: string[];
  effectiveFrom: string | null; effectiveTo: string | null; courtIds: string[];
  verification: string; runtimeMode: string; editable: boolean;
  consumers: ReferenceConsumer[]; condition: unknown; consequence: unknown;
  requiresHumanReview: boolean; sha256: string; lockedSafetyInvariant?: boolean;
  [key: string]: unknown;
}
export const REFERENCE_RELEASE = freezeReferenceValue(release);
export const REFERENCE_RECORDS = freezeReferenceValue(data.records as unknown as readonly ReferenceRecord[]);
const allRecords:readonly ReferenceRecord[]=[...REFERENCE_RECORDS,...MANAGED_REFERENCE_RECORDS];
const records = new Map(allRecords.map(record => [record.id, record]));
export function referenceRecord(id: string): ReferenceRecord | undefined { return records.get(id); }
export function currentReferenceRecord(id: string): ReferenceRecord | undefined {
  const row = records.get(id);
  if(!row)return undefined;
  const active=currentReferenceSnapshot(),metadata=active?.metadata?.[id];
  return { ...row,value:readReferenceValue(id,row.value),...(metadata?{sourceUrls:metadata.sourceUrls,effectiveFrom:metadata.effectiveFrom,verification:"human_reviewed_reference_change",sha256:metadata.recordSha256,seedRecordSha256:row.sha256,activeReleaseSha256:active!.sha256,changeProvenance:metadata}:{}) };
}
export function referenceRecordsPage(input: { kind?: string; q?: string; offset?: number; limit?: number }) {
  const q=(input.q??"").trim().toLowerCase();
  const filtered=allRecords.filter(row => (!input.kind || row.kind===input.kind) && (!q || [row.id,row.title,row.category,...row.sourceIds,...row.sourceUrls,...row.consumers.map(c=>c.path)].join(" ").toLowerCase().includes(q)));
  const offset=Math.max(0,Math.floor(input.offset??0)),limit=Math.min(100,Math.max(1,Math.floor(input.limit??50)));
  return {items:filtered.slice(offset,offset+limit).map(row=>currentReferenceRecord(row.id)!),total:filtered.length,nextOffset:offset+limit<filtered.length?offset+limit:null};
}
export function referenceMonitorRules() {
  // The live consultation catalog is versioned separately and is joined by the
  // monitor store. Do not mix its historical seed with an edited current master.
  return REFERENCE_RECORDS.filter(r=>r.kind!=="code_criterion" && r.kind!=="legacy_vocabulary" && !r.kind.startsWith("intake_")).map(row=>currentReferenceRecord(row.id)!).map(r=>({id:r.id,title:r.title,category:r.category,sourceIds:r.sourceIds,sourceUrls:r.sourceUrls,keywords:[r.title,...r.sourceIds]}));
}

function sameShape(original:unknown,value:unknown,depth=0):boolean {
  if(depth>20)return false;
  if(original===null)return value===null||typeof value==="string"||typeof value==="number"&&Number.isFinite(value);
  if(typeof original!==typeof value)return false;
  if(typeof value==="number")return Number.isSafeInteger(value)&&value>=0;
  if(typeof value==="string"){
    if(value.length>20000)return false;
    if(typeof original==="string"&&/^\d+$/.test(original))return /^\d{1,30}$/.test(value);
    if(typeof original==="string"&&/^\d+\.\d+$/.test(original))return /^\d{1,20}(?:\.\d{1,12})?$/.test(value);
    return true;
  }
  if(Array.isArray(original))return Array.isArray(value)&&value.length===original.length&&value.every((v,i)=>sameShape(original[i],v,depth+1));
  if(original&&typeof original==="object")return !!value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(original).length===Object.keys(value).length&&Object.keys(original).every(k=>Object.hasOwn(value,k)&&!["__proto__","constructor","prototype"].includes(k)&&sameShape((original as Record<string,unknown>)[k],(value as Record<string,unknown>)[k],depth+1));
  return typeof value==="boolean";
}
export function validateReferenceValue(record: ReferenceRecord, value: unknown): void {
  if(record.id===SUBSTITUTION_POLICY_REFERENCE_ID){
    if(!record.editable||record.lockedSafetyInvariant)throw new Error("REFERENCE_RECORD_REQUIRES_CODE_RELEASE");
    validateSubstitutionPolicy(value);return;
  }
  if(!record.editable || record.lockedSafetyInvariant || record.id.startsWith("param.compiled_policy.") || record.id.startsWith("param.formula.") || !["parameter","prompt"].includes(record.kind))throw new Error("REFERENCE_RECORD_REQUIRES_CODE_RELEASE");
  if(record.id==="param.seoul.living.median_income_tables") {
    if(!value||typeof value!=="object"||Array.isArray(value)||!Object.keys(value).length||Object.entries(value).some(([year,table])=>!/^20\d\d$/.test(year)||!Array.isArray(table)||table.length!==7||table.some(v=>typeof v!=="string"||!/^\d{1,15}$/.test(v)||BigInt(v)<=0n)))throw new Error("INVALID_REFERENCE_VALUE");
    return;
  }
  if(!sameShape(record.value,value))throw new Error("INVALID_REFERENCE_VALUE");
  if(typeof record.value==="string"&&/^\d+$/.test(record.value)&&(!/^\d+$/.test(String(value))||String(value).length>30))throw new Error("INVALID_REFERENCE_MONEY");
  if(record.id.endsWith(".comparison") && !["lte","lt"].includes(String(value)))throw new Error("INVALID_REFERENCE_COMPARISON");
  if(value&&typeof value==="object"&&!Array.isArray(value)&&"denominator" in value&&!(typeof value.denominator==="number"&&value.denominator>0))throw new Error("INVALID_REFERENCE_RATIO");
  if(record.id.includes("months")&&(typeof value!=="number"||value<1||value>1200))throw new Error("INVALID_REFERENCE_PERIOD");
  if(["years","months","basis_points"].includes(record.unit??"")&&(typeof value!=="number"||!Number.isSafeInteger(value)||value<1))throw new Error("INVALID_REFERENCE_POSITIVE_INTEGER");
  if(record.unit==="ISO-8601-date"&&(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))throw new Error("INVALID_REFERENCE_DATE");
  if(record.unit==="URL") {try{const u=new URL(String(value));if(u.protocol!=="https:"||u.username||u.password||!(u.hostname==="law.go.kr"||u.hostname.endsWith(".go.kr")||u.hostname==="scourt.go.kr"||u.hostname.endsWith(".scourt.go.kr")))throw new Error();}catch{throw new Error("INVALID_REFERENCE_SOURCE_URL");}}
  if(record.kind==="prompt"){
    const expected=new Set(Array.isArray(record.placeholders)?record.placeholders as string[]:[]),actual=new Set([...String(value).matchAll(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g)].map(m=>m[1]));
    if(expected.size!==actual.size||[...actual].some(v=>!expected.has(v)))throw new Error("REFERENCE_PROMPT_PLACEHOLDERS_CHANGED");
  }
}
