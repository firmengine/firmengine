/** Source-data and substitute-document change processors.
 * Substitution decisions are deterministic, source-bound, reversible and
 * never issue document deletion, legal acceptance or filing approval.
 */
import { drainCaseDataUpdates } from "./case-data-recompute.ts";
import { drainCaseLegalAutomation } from "./case-legal-automation.ts";
import { reviewLegal } from "./pipeline.ts";
import { generateAutomaticReviewDraft } from "./automatic-review-draft.ts";
import {inspectLegalAutomationSourceReadiness} from "./case-legal-source-preflight.ts";
import {inspectLegalAutomationCalculationReadiness} from "./case-legal-calculation-preflight.ts";
import { drainCaseSubstitutionWatch } from "./case-substitution-watch.ts";
import { getIntakeCatalog } from "./intake-store.ts";
import { db, getCase, caseExtras } from "./server-store.ts";

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
  let legal;
  try{
    legal=await drainCaseLegalAutomation(database,{caseId:input.caseId,limit,services:{
      loadCase:getCase,reviewLegal,
      processingComplete:async data=>(await caseExtras(data)).processingReadiness.complete,
      sourceReadiness:async data=>{
        const source=await inspectLegalAutomationSourceReadiness(database,data,
          (await caseExtras(data)).processingReadiness.complete);
        if(!source.ready)return source;
        // Do not start a 95-check paid model cycle when deterministic finance
        // source bindings are inconsistent or an approved required calculator
        // output is already missing. Optional provisional legal judgments are
        // deliberately left for lawyer review, not suppressed by this guard.
        return inspectLegalAutomationCalculationReadiness(database,data);
      },
      generateDraft:generateAutomaticReviewDraft,
    }});
  }catch(error){
    legal={scanned:0,reviewing:0,draftReady:0,attention:0,results:[],
      status:"unavailable" as const,reason:error instanceof Error&&error.message.startsWith("LEGAL_")
        ?error.message:"LEGAL_AUTOMATION_STORAGE_OR_PROCESSOR_UNAVAILABLE"};
  }
  return {...calculated,substitution,legal};
}
