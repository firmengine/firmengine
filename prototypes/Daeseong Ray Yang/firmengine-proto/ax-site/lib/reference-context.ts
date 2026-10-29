import { AsyncLocalStorage } from "node:async_hooks";
import release from "./reference-release.json" with { type: "json" };
import { installReferenceProvider, freezeReferenceValue, referenceSnapshotHash, type ReferenceSnapshot } from "./reference-runtime.ts";

const context = new AsyncLocalStorage<ReferenceSnapshot>();
installReferenceProvider(() => context.getStore());

export function seedReferenceSnapshot(): ReferenceSnapshot { return freezeReferenceValue({id:release.id,revision:release.revision,sha256:release.sha256,values:{}}); }
export async function loadReferenceSnapshot(database?: D1Database): Promise<ReferenceSnapshot> {
  if(!database)return seedReferenceSnapshot();
  let row:{id:string;revision:number;sha256:string;seedSha256:string;payload:string}|null;
  try {
    row=await database.prepare("SELECT id,revision,sha256,seed_sha256 AS seedSha256,payload FROM legal_reference_releases WHERE status = 'active' ORDER BY revision DESC LIMIT 1").first();
  } catch(error) {
    if(error instanceof Error && /no such table.*legal_reference_releases/.test(error.message))return seedReferenceSnapshot();
    throw new Error("REFERENCE_RELEASE_UNAVAILABLE");
  }
  if(!row)return seedReferenceSnapshot();
  if(row.seedSha256!==release.sha256) {
    if(row.revision===1)return seedReferenceSnapshot();
    throw new Error("REFERENCE_RELEASE_CODE_MISMATCH");
  }
  const parsed=JSON.parse(row.payload) as {values:Record<string,unknown>;metadata?:ReferenceSnapshot["metadata"]};
  if(!parsed.values||typeof parsed.values!=="object"||Array.isArray(parsed.values))throw new Error("INVALID_REFERENCE_RELEASE");
  if(row.revision===1){if(Object.keys(parsed.values).length||row.sha256!==release.sha256)throw new Error("REFERENCE_RELEASE_INTEGRITY_FAILED");}
  else {
    if(await referenceSnapshotHash(release.sha256,parsed.values,parsed.metadata??{})!==row.sha256)throw new Error("REFERENCE_RELEASE_INTEGRITY_FAILED");
    const {referenceRecord,validateReferenceValue}=await import("./reference-registry.ts");
    for(const [id,value]of Object.entries(parsed.values)){const record=referenceRecord(id);if(!record)throw new Error("UNKNOWN_REFERENCE_ID");validateReferenceValue(record,value);if(!parsed.metadata?.[id])throw new Error("REFERENCE_CHANGE_PROVENANCE_MISSING");}
  }
  return freezeReferenceValue({id:row.id,revision:row.revision,sha256:row.sha256,values:parsed.values,metadata:parsed.metadata??{}});
}
export async function runWithReferenceContext<T>(database:D1Database|undefined,run:()=>T):Promise<Awaited<T>> {
  const snapshot=await loadReferenceSnapshot(database);
  return context.run(snapshot,run) as Awaited<T>;
}
export function runWithReferenceSnapshot<T>(snapshot:ReferenceSnapshot,run:()=>T):T { return context.run(freezeReferenceValue(snapshot),run); }
