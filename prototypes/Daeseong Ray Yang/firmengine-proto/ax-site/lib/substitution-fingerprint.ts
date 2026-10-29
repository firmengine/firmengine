import type { Fact } from "./domain.ts";
/** Stable, one-way fingerprint of exactly the source values used to approve a
 * substitute; no raw source values are copied into the review receipt.
 * This is a stale-dependency check, not an evidence authenticity proof.
 */
const canonical=(value:unknown):string=>{
 if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
 if(value&&typeof value==="object")return "{"+Object.entries(value).filter(([,v])=>v!==undefined)
  .sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+":"+canonical(v)).join(",")+"}";
 return JSON.stringify(value)??"null";
};
export async function substitutionFactFingerprint(fact:Fact):Promise<string>{
 const material={
  id:fact.id,logicalId:fact.logicalId,version:fact.version,subjectId:fact.subjectId,
  key:fact.key,canonicalFieldId:fact.canonicalFieldId??null,
  value:fact.value,rawValue:fact.rawValue??null,
  state:fact.state,recognition:fact.recognition,
  periodStart:fact.periodStart??null,periodEnd:fact.periodEnd??null,asOf:fact.asOf??null,
  validation:fact.validation??[],refs:fact.refs,fieldObservation:fact.fieldObservation??null
 };
 const bytes=new TextEncoder().encode(canonical(material));
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
 return [...digest].map(v=>v.toString(16).padStart(2,"0")).join("");
}
