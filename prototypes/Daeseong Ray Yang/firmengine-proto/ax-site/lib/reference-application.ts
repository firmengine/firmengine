import release from "./reference-release.json" with { type: "json" };
import { currentReferenceSnapshot, referenceIdentity, type ReferenceSnapshot } from "./reference-runtime.ts";
import { resolveReferenceBundle } from "./reference-resolver.ts";
import { inspectReferenceBundle, type ReferenceBundle } from "./reference-bundle.ts";
import type { CaseData } from "./domain.ts";

export interface ReferenceApplicationReceipt {
  schemaVersion:"reference-application-resolution/1"; status:"resolved"|"unresolved"; applicable:boolean;
  selectedBundleId:string|null; selectedBundleHash:string|null; artifactIds:string[];
  snapshotId:string|null; snapshotHash:string|null; jurisdiction:string|null; dateBasis:string|null; effectiveDate:string|null;
  reasonCodes:string[]; finalGate:"REFERENCE_APPLICATION_UNRESOLVED"|null;
  bundleInspection:{compatibility:string;artifactCount:number;missingDateBasisCount:number;unknownTransitionCount:number;missingJurisdictionCount:number};
}
export function referenceBundleForSnapshot(snapshot:ReferenceSnapshot):ReferenceBundle {
  const artifacts=snapshot.bundleReview?.artifacts??[];
  return {id:snapshot.id,revision:String(snapshot.revision),sha256:snapshot.sha256,compatibility:snapshot.bundleReview?"verified":"unknown",artifacts};
}
export function inspectReferenceSnapshotBundle(snapshot:ReferenceSnapshot) { return inspectReferenceBundle(referenceBundleForSnapshot(snapshot)); }
/** Resolves only explicit case declarations. Legacy snapshots remain ungated. */
export function resolveReferenceApplicationForCase(data:CaseData,bundles:readonly ReferenceBundle[]=[],providedSnapshot?:ReferenceSnapshot):ReferenceApplicationReceipt {
  const context=data.context as CaseData["context"]&{referenceApplicationRequired?:boolean;referenceBundleId?:string;referenceDateBasis?:string;referenceEffectiveDate?:string;referenceArtifactIds?:string[]};
  const snapshot=providedSnapshot??currentReferenceSnapshot()??{id:release.id,revision:release.revision,sha256:release.sha256,values:{}};
  const currentBundle=referenceBundleForSnapshot(snapshot);
  const applicableBundles=bundles.length?bundles:[currentBundle];
  const jurisdiction=typeof context.courtId==="string"&&context.courtId?context.courtId:null;
  const dateBasis=context.referenceDateBasis??null,effectiveDate=context.referenceEffectiveDate??null;
  const applicable=context.referenceApplicationRequired===true||Boolean(context.referenceBundleId||dateBasis||effectiveDate||context.referenceArtifactIds?.length);
  const selected=context.referenceBundleId?applicableBundles.filter(bundle=>bundle.id===context.referenceBundleId):applicableBundles;
  const dates:Record<string,string>={}; if(dateBasis&&effectiveDate)dates[dateBasis]=effectiveDate;
  const resolution=resolveReferenceBundle(selected,{jurisdiction:jurisdiction??"",dates,requiredArtifacts:context.referenceArtifactIds});
  const identity=referenceIdentity(),inspection=inspectReferenceBundle(currentBundle),reasonCodes=resolution.status==="unresolved"?[...resolution.reasonCodes]:[];
  if(!dateBasis)reasonCodes.push("date_basis_not_declared"); if(!jurisdiction)reasonCodes.push("jurisdiction_not_declared");
  return {schemaVersion:"reference-application-resolution/1",status:resolution.status,applicable,
    selectedBundleId:resolution.status==="resolved"?resolution.bundleId:null,selectedBundleHash:resolution.status==="resolved"?resolution.bundleHash:null,
    artifactIds:resolution.status==="resolved"?resolution.artifacts.map(artifact=>artifact.id):[],snapshotId:identity?.id??snapshot.id,snapshotHash:identity?.sha256??snapshot.sha256,
    jurisdiction,dateBasis,effectiveDate,reasonCodes:[...new Set(reasonCodes)],finalGate:applicable&&resolution.status==="unresolved"?"REFERENCE_APPLICATION_UNRESOLVED":null,
    bundleInspection:{compatibility:inspection.compatibility,artifactCount:inspection.artifactCount,missingDateBasisCount:inspection.missingDateBasisIds.length,unknownTransitionCount:inspection.unknownTransitionIds.length,missingJurisdictionCount:inspection.missingJurisdictionIds.length}};
}
