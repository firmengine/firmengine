/** Source-data and substitute-document change processors.
 * Substitution decisions are deterministic, source-bound, reversible and
 * never issue document deletion, legal acceptance or filing approval.
 */
import { drainCaseDataUpdates } from "./case-data-recompute.ts";
import { drainCaseSubstitutionWatch } from "./case-substitution-watch.ts";
import { getIntakeCatalog } from "./intake-store.ts";
import { db, getCase } from "./server-store.ts";

export async function processCaseAgentUpdates(input:{caseId?:string;limit?:number}={}){
  if(input.caseId!==undefined&&(!input.caseId.trim()||input.caseId.length>300))throw new Error("INVALID_CASE_ID");
  if(input.limit!==undefined&&(!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>5))throw new Error("INVALID_PROCESS_LIMIT");
  const database=db(),limit=input.limit??3;
  // Restoration cannot wait for the calculator's 10-minute quiet window.
  // Scan current source revisions first; other calculations remain unchanged.
  let substitution;
  try{
    substitution=await drainCaseSubstitutionWatch(database,{
      caseId:input.caseId,limit,source:{
        getCase,getCatalogVersion:async()=>(await getIntakeCatalog()).catalog.version
      }
    });
  }catch(error){
    substitution={status:"unavailable" as const,
      reason:error instanceof Error?error.message:"CASE_SUBSTITUTION_WATCH_UNAVAILABLE",
      scanned:0,deactivated:0,restored:0,results:[]};
  }
  const calculated=await drainCaseDataUpdates(database,{caseId:input.caseId,limit,loadCase:getCase});
  return {...calculated,substitution};
}
