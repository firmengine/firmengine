/** Immutable identity for one compatible set of legal/reference artifacts. */
export interface ReferenceArtifact {
  id: string; revision: string; sha256: string;
  effectiveFrom?: string | null; effectiveTo?: string | null;
  jurisdiction?: string | null; dateBasis?: string | null;
  transition?: { status: "declared" | "unknown"; from?: string; to?: string; conditions?: string[] };
}
export interface ReferenceBundle {
  id: string; revision: string; sha256: string;
  artifacts: readonly ReferenceArtifact[];
  compatibility: "verified" | "unknown" | "incompatible";
}
export type BundleValidation = { valid: true; bundle: ReferenceBundle } | { valid: false; issues: string[] };
const HASH = /^[a-f0-9]{64}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Structural integrity only; this does not assert legal currency or approval. */
export function validateReferenceBundle(bundle: ReferenceBundle): BundleValidation {
  const issues: string[] = [];
  if (!bundle.id || !bundle.revision || !HASH.test(bundle.sha256)) issues.push("invalid_bundle_identity");
  if (!Array.isArray(bundle.artifacts) || bundle.artifacts.length === 0) issues.push("missing_artifacts");
  const ids = new Set<string>();
  for (const a of bundle.artifacts ?? []) {
    if (!a.id || !a.revision || !HASH.test(a.sha256)) issues.push(`invalid_artifact_identity:${a.id || "unknown"}`);
    if (ids.has(a.id)) issues.push(`duplicate_artifact:${a.id}`); ids.add(a.id);
    for (const d of [a.effectiveFrom, a.effectiveTo]) if (d != null && !DATE.test(d)) issues.push(`invalid_effective_date:${a.id}`);
    if (a.effectiveFrom && a.effectiveTo && a.effectiveFrom > a.effectiveTo) issues.push(`reversed_effective_range:${a.id}`);
    if (a.transition?.status !== "declared" && a.transition?.status !== "unknown") issues.push(`transition_status_required:${a.id}`);
  }
  return issues.length ? {valid:false,issues} : {valid:true,bundle};
}
export interface ReferenceRuntimeHealthInput { snapshotPresent:boolean; snapshotHashValid:boolean; snapshotReadable:boolean; registryHydrated:boolean; hydratedArtifactIds?:readonly string[]; expectedArtifactIds?:readonly string[] }
/** Snapshot integrity and search-index hydration are separate health dimensions. */
export function referenceRuntimeHealth(input:ReferenceRuntimeHealthInput) {
  const snapshotIntegrity = !input.snapshotPresent ? "missing" : !input.snapshotReadable ? "unreadable" : input.snapshotHashValid ? "valid" : "invalid";
  const hydrated = new Set(input.hydratedArtifactIds ?? []);
  const expected = input.expectedArtifactIds ?? [];
  const missingHydratedArtifacts = expected.filter(id => !hydrated.has(id));
  const registryHydration = !input.registryHydrated ? "not_hydrated" : missingHydratedArtifacts.length ? "partial" : "hydrated";
  return { snapshotIntegrity, registryHydration, missingHydratedArtifacts } as const;
}

export interface ReferenceArtifactSeed { id:string; sha256:string; effectiveFrom?:string|null; effectiveTo?:string|null; jurisdiction?:string|null; applicationContract?:{dateBasis?:string;jurisdiction?:string|null;effectiveTo?:string|null;transition?:ReferenceArtifact["transition"]} }
export function referenceBundleFromSnapshot(snapshot:{id:string;revision:number;sha256:string;metadata?:Readonly<Record<string,{effectiveFrom?:string|null;applicationContract?:ReferenceArtifactSeed["applicationContract"]}>>;bundleReview?:{status:"verified";basedOnSha256:string;artifactIds:readonly string[];artifacts:readonly ReferenceArtifact[];reason:string;reviewedAt:string;reviewedBy:string}},records:readonly ReferenceArtifactSeed[]):ReferenceBundle {
 const selected=snapshot.bundleReview?new Set(snapshot.bundleReview.artifactIds):null;
 const artifacts=snapshot.bundleReview?[...snapshot.bundleReview.artifacts]:records.filter(record=>!selected||selected.has(record.id)).map(record=>{const meta=snapshot.metadata?.[record.id],contract=meta?.applicationContract??record.applicationContract;return {id:record.id,revision:String(snapshot.revision),sha256:record.sha256,effectiveFrom:meta?.effectiveFrom??record.effectiveFrom??null,effectiveTo:contract?.effectiveTo??record.effectiveTo??null,jurisdiction:contract?.jurisdiction??record.jurisdiction??null,dateBasis:contract?.dateBasis,transition:contract?.transition??{status:"unknown" as const}};});
 return {id:snapshot.id,revision:String(snapshot.revision),sha256:snapshot.sha256,compatibility:snapshot.bundleReview?"verified":"unknown",artifacts};
}
export function inspectReferenceBundle(bundle:ReferenceBundle){
 return {id:bundle.id,revision:bundle.revision,sha256:bundle.sha256,compatibility:bundle.compatibility,artifactCount:bundle.artifacts.length,
  missingDateBasisIds:bundle.artifacts.filter(a=>!a.dateBasis).map(a=>a.id),unknownTransitionIds:bundle.artifacts.filter(a=>a.transition?.status!=="declared"||(a.transition.conditions?.length??0)>0).map(a=>a.id),
  missingJurisdictionIds:bundle.artifacts.filter(a=>!a.jurisdiction).map(a=>a.id)};
}
