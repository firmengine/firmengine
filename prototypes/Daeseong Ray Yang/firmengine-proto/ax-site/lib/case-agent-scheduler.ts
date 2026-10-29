/** Bounded processing of source-change notifications.
 * Deterministic calculation only; it never grants legal or filing approval.
 * Existing reconciliation and document review stages retain their human gates. */
import { drainCaseDataUpdates } from "./case-data-recompute.ts";
import { db, getCase } from "./server-store.ts";

export async function processCaseAgentUpdates(input:{caseId?:string;limit?:number}={}){
  if(input.caseId!==undefined&&(!input.caseId.trim()||input.caseId.length>300))throw new Error("INVALID_CASE_ID");
  if(input.limit!==undefined&&(!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>5))throw new Error("INVALID_PROCESS_LIMIT");
  return drainCaseDataUpdates(db(),{caseId:input.caseId,limit:input.limit,loadCase:getCase});
}
