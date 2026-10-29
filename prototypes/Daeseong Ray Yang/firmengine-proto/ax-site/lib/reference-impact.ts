export interface ReferenceDependency { caseId:string; runId?:string; documentIds?:string[]; jurisdiction?:string|null; dates?:Readonly<Record<string,string>>|null; dependencyIds?:readonly string[]|null; state?:"open"|"submitted"|"closed"|"unknown" }
export interface ReferenceChange { artifactIds:readonly string[]; jurisdictions?:readonly string[]; dateBasis?:string; effectiveFrom?:string; effectiveTo?:string }
export interface ImpactTask { key:string; caseId:string; kind:"compare_recalculate_rereview"; runId?:string; documentIds:string[] }
export interface ReferenceImpact { affected:string[]; unknown:string[]; unaffected:string[]; tasks:ImpactTask[] }
const inRange=(d:string,c:ReferenceChange)=>(!c.effectiveFrom||d>=c.effectiveFrom)&&(!c.effectiveTo||d<=c.effectiveTo);
/** Compare declared dependencies and actual case date/jurisdiction. Unknown stays visible. */
export function planReferenceImpact(cases:readonly ReferenceDependency[], change:ReferenceChange):ReferenceImpact {
 const affected:string[]=[],unknown:string[]=[],unaffected:string[]=[],tasks:ImpactTask[]=[]; const seen=new Set<string>();
 for(const c of cases){
  if(c.state==="submitted"||c.state==="closed"){unaffected.push(c.caseId);continue;}
  if(!Array.isArray(c.dependencyIds)){unknown.push(c.caseId);continue;}
  const dependencyMatch=c.dependencyIds.some(id=>change.artifactIds.includes(id));
  if(!dependencyMatch){unaffected.push(c.caseId);continue;}
  if(change.jurisdictions?.length){if(!c.jurisdiction){unknown.push(c.caseId);continue;}if(!change.jurisdictions.includes(c.jurisdiction)){unaffected.push(c.caseId);continue;}}
  if(change.effectiveFrom||change.effectiveTo){const date=change.dateBasis?c.dates?.[change.dateBasis]:undefined;if(!change.dateBasis||!date){unknown.push(c.caseId);continue;}if(!inRange(date,change)){unaffected.push(c.caseId);continue;}}
  if(c.state!=="open"){unknown.push(c.caseId);continue;}
  affected.push(c.caseId);const key=`${c.caseId}:${c.runId??"unknown"}:${[...change.artifactIds].sort().join(",")}`;
  if(!seen.has(key)){seen.add(key);tasks.push({key,caseId:c.caseId,kind:"compare_recalculate_rereview",runId:c.runId,documentIds:[...(c.documentIds??[])]});}
 }
 return {affected:[...new Set(affected)],unknown:[...new Set(unknown)],unaffected:[...new Set(unaffected)],tasks};
}
