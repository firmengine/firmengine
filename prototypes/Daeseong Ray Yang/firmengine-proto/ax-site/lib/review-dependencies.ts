import { currentFacts, type CaseData } from "./domain.ts";

export type ReviewDependencies = { fingerprint: string; factIds: string[]; contextKeys: string[]; artifactKinds: string[]; fingerprintScheme:"review-dependencies/1:sha256" };
export const canonicalJson=(value:unknown):string=>{
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(item=>item===undefined?"null":canonicalJson(item)).join(",")}]`;
  const entries=Object.entries(value as Record<string,unknown>).filter(([,item])=>item!==undefined).sort(([a],[b])=>a.localeCompare(b));
  return `{${entries.map(([key,item])=>`${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
};
/** Stable, narrowly scoped dependency snapshot. Caller supplies the keys relevant to its review. */
export async function deriveReviewDependencies(data: CaseData, options: { factIds?: string[]; contextKeys?: string[]; artifactKinds?: string[] } = {}): Promise<ReviewDependencies> {
  const factIds=[...new Set(options.factIds ?? currentFacts(data).map(f=>f.id))].sort();
  // Review receipts must not fingerprint themselves or other review-only switches.
  const contextKeys=[...new Set(options.contextKeys ?? ["applicationDate","asOf","courtId","ruleReleaseId"])].filter(key=>!/(?:reviewed|reviewsha256)$/i.test(key)).sort();
  const artifactKinds=[...new Set(options.artifactKinds ?? [])].sort();
  const facts=currentFacts(data).filter(f=>factIds.includes(f.id)).map(f=>({id:f.id,logicalId:f.logicalId,version:f.version,key:f.key,subjectId:f.subjectId,value:f.value,rawValue:f.rawValue,sourceUnit:f.sourceUnit,numeric:f.numeric,periodStart:f.periodStart,periodEnd:f.periodEnd,asOf:f.asOf,refs:f.refs.map(ref=>({documentId:ref.documentId,page:ref.page,quote:ref.quote,sourceHash:ref.sourceHash,bbox:ref.bbox})),structuredRefs:f.structuredRefs,state:f.state,recognition:f.recognition}));
  const context=Object.fromEntries(contextKeys.map(key=>[key,(data.context as unknown as Record<string,unknown>)[key]]));
  const artifactFiles=(data.exportManifest?.files??[]).filter(file=>artifactKinds.includes(file.kind)).map(file=>({id:file.id,kind:file.kind,hash:file.hash,status:file.status})).sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
  const payload=canonicalJson({scheme:"review-dependencies/1",facts,context,artifactKinds,artifactFiles});
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(payload)));
  const fingerprint=[...digest].map(byte=>byte.toString(16).padStart(2,"0")).join("");
  return {fingerprint:`review-dependencies/1:sha256:${fingerprint}`,factIds,contextKeys,artifactKinds,fingerprintScheme:"review-dependencies/1:sha256"};
}
export function reviewDependenciesCurrent(record: Pick<ReviewDependencies,"fingerprint"|"fingerprintScheme">, current: ReviewDependencies): boolean { return record.fingerprintScheme===current.fingerprintScheme&&/^review-dependencies\/1:sha256:[a-f0-9]{64}$/.test(record.fingerprint)&&record.fingerprint===current.fingerprint; }
