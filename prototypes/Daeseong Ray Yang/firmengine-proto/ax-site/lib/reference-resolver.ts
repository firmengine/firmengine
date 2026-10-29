import type { ReferenceArtifact, ReferenceBundle } from "./reference-bundle.ts";
import { validateReferenceBundle } from "./reference-bundle.ts";
const validDate=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const time=Date.parse(value+"T00:00:00Z");return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;};
export interface ReferenceRequest { jurisdiction: string; dates: Readonly<Record<string,string>>; requiredArtifacts?: readonly string[] }
export type ReferenceResolution = { status:"resolved"; bundleId:string; bundleHash:string; artifacts:readonly ReferenceArtifact[] } | { status:"unresolved"; reasonCodes:string[]; candidates:string[] };
/** Resolve only a unique, explicitly applicable bundle; never fall back to newest. */
export function resolveReferenceBundle(bundles: readonly ReferenceBundle[], request: ReferenceRequest): ReferenceResolution {
  const reasons:string[]=[];
  if (!request.jurisdiction) reasons.push("jurisdiction_missing");
  if (!Object.keys(request.dates).length) reasons.push("date_basis_missing");
  for(const [basis,date] of Object.entries(request.dates))if(!validDate(date))reasons.push(`invalid_request_date:${basis}`);
  const valid=bundles.filter(b=>validateReferenceBundle(b).valid);
  const candidates=valid.filter(b=>b.compatibility !== "incompatible").filter(b=>{
    const byId=new Map(b.artifacts.map(a=>[a.id,a]));
    for(const id of request.requiredArtifacts??[]) if(!byId.has(id)) return false;
    const selected=request.requiredArtifacts?.length?(request.requiredArtifacts.map(id=>byId.get(id)!)):[...byId.values()];
    return selected.every(a=>!a.jurisdiction||a.jurisdiction===request.jurisdiction);
  });
  if (!candidates.length) return {status:"unresolved",reasonCodes:[...reasons,"no_compatible_bundle"],candidates:[]};
  const applicable=candidates.filter(b=>{
    const selected=request.requiredArtifacts?.length?request.requiredArtifacts.map(id=>b.artifacts.find(a=>a.id===id)!):b.artifacts;
    return selected.every(a=>{
    if(!a.dateBasis) return false;
    const date=request.dates[a.dateBasis]; if(!date) return false;
    if(a.transition?.status!=="declared" || (a.transition.conditions?.length ?? 0) > 0) return false;
    return (!a.effectiveFrom||date>=a.effectiveFrom)&&(!a.effectiveTo||date<=a.effectiveTo);
    });
  });
  if(applicable.length!==1) return {status:"unresolved",reasonCodes:[...reasons,applicable.length?"overlapping_applicability":"date_basis_or_transition_unresolved"],candidates:applicable.length?applicable.map(b=>b.id):candidates.map(b=>b.id)};
  const b=applicable[0];
  if(reasons.length||b.compatibility!=="verified") return {status:"unresolved",reasonCodes:[...reasons,...(b.compatibility!=="verified"?["compatibility_unverified"]:[])],candidates:[b.id]};
  const artifacts=request.requiredArtifacts?.length?request.requiredArtifacts.map(id=>b.artifacts.find(a=>a.id===id)!):b.artifacts;
  return {status:"resolved",bundleId:b.id,bundleHash:b.sha256,artifacts};
}
