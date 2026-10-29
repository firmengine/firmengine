import { commandHash } from "./case-command-contract.ts";
import { currentFacts,type CaseData } from "./domain.ts";
export interface LegalDispositionIdentity { checkId:string;runId:string;subjectFingerprint:string;dependencyFingerprint:string;status:"accepted"|"rejected"|"needs_review"; }
export interface LegalReviewRunIdentity { checkId:string;id:string;subjectFingerprint:string;dependencyFingerprint:string;status:string; }
export type LegalRunConflictProjection<T extends LegalReviewRunIdentity> = T & {conflict:boolean;conflictingStatuses:string[];conflictingRunIds:string[];conflictingFactIds:string[]};
/** Marks contradictory outcomes for the same current check subject and retains the evidence IDs needed to review the conflict. */
export function projectLegalRunConflicts<T extends LegalReviewRunIdentity & {factIds?:string[]}>(runs:readonly T[]):LegalRunConflictProjection<T>[] {
 const groups=new Map<string,T[]>();
 for(const run of runs){const key=`${run.checkId}\u0000${run.subjectFingerprint}`;groups.set(key,[...(groups.get(key)??[]),run]);}
 return runs.map(run=>{
  const group=groups.get(`${run.checkId}\u0000${run.subjectFingerprint}`)??[],statuses=[...new Set(group.map(item=>item.status))].sort(),conflict=statuses.length>1;
  return {...run,conflict,conflictingStatuses:conflict?statuses:[],conflictingRunIds:conflict?group.map(item=>item.id).sort():[],conflictingFactIds:conflict?[...new Set(group.flatMap(item=>item.factIds??[]))].sort():[]};
 });
}
/** Stale accepted receipts lose authority; rejected and unresolved receipts remain blockers. */
export function currentLegalDispositionOutcome(disposition:LegalDispositionIdentity,runs:readonly LegalReviewRunIdentity[]):"accepted"|"rejected"|"needs_review"{
  const matchingRuns=runs.filter(run=>run.checkId===disposition.checkId&&run.subjectFingerprint===disposition.subjectFingerprint),outcomes=new Set(matchingRuns.map(run=>run.status));
  if(outcomes.size>1)return "needs_review";
  const current=matchingRuns.some(run=>run.id===disposition.runId&&run.dependencyFingerprint===disposition.dependencyFingerprint);
  return current&&disposition.status==="accepted"?"accepted":disposition.status==="rejected"?"rejected":"needs_review";
}
/** The advisory's inputs; assignments, dispositions and document prose cannot invalidate their own evidence. */
export async function legalReviewInputFingerprint(data:CaseData,referenceSha256:string,contractVersion:string){
  const context=Object.fromEntries(Object.entries(data.context).filter(([key])=>key!=="revision"&&key!=="caseName"&&!/Reviewed$|ReviewSha256$/.test(key)));
  return `legal-review-input/1:${await commandHash({context,facts:currentFacts(data),incomes:data.incomes,debts:data.debts,assets:data.assets,household:data.household,transactions:data.transactions,documents:data.documents,pages:data.pages,referenceSha256,contractVersion})}`;
}
