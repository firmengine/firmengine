import { CURRENT_RULESET, LEGAL_CATALOG, RISK_CATALOG } from "./legal-rules";
import { caseExtras, getCase, jobs, persistedRescuePlans } from "./server-store";
import type { CaseData } from "./domain";
import { applyProcessingGate } from "./processing-readiness";
import { samplePageRole } from "./sample-manifest";
import { rescuePlanInScope,assertProcessJobRows,isCurrentEvidenceJob } from "./process-job-scope";
import { executeCaseNodes } from "./case-execution";
export async function caseResponse(data:CaseData|string){
  const c=typeof data==="string"?await getCase(data):data;
  const extras=await caseExtras(c);
  const {derivedEvaluation,...publicExtras}=extras;
  const execution=derivedEvaluation?.status==="complete"&&derivedEvaluation.execution?derivedEvaluation.execution:executeCaseNodes(c,{includeDocumentBindings:true}),assessment=execution.assessment;
  const evaluationReceipt=derivedEvaluation?Object.fromEntries(Object.entries(derivedEvaluation).filter(([key])=>!["execution","executionPointer","storageToken"].includes(key))):{status:"pending",revision:c.context.revision};
  const gatedAssessment=applyProcessingGate(assessment,extras.processingReadiness);
  const documents=c.documents.map(document=>{const rows=extras.jobs.filter(j=>j.documentId===document.id);const active=rows.filter(j=>!["held","withdrawn"].includes(String(j.status)));const extractionStatus=active.some(j=>["error","review_required"].includes(String(j.status)))?"failed":active.some(j=>j.status==="processing")?"processing":rows.length&&active.every(j=>j.status==="completed")?"completed":"pending";return {...document,extractionStatus};});
  return {case:{...c,documents,execution:extras.execution??c.execution},assessment:gatedAssessment,...publicExtras,derivedEvaluation:evaluationReceipt,workflow:execution.workflow,executionPlan:{...execution.plan,generationGate:gatedAssessment.generationGate,processingReadiness:extras.processingReadiness},documentBindings:execution.formBindings,documentPayloads:execution.documentPayloads,transactionReview:execution.transactionReview,rules:CURRENT_RULESET,legalCatalog:LEGAL_CATALOG,riskCatalog:RISK_CATALOG};
}

export async function caseProgress(caseId:string,result:{remaining?:number;stage?:string;page?:number;error?:string;warnings?:unknown[];checks?:{status?:string}[];disagreements?:number;rescue?:{planId:string;documentId:string;page:number;sourceHash:string;baseImageHash:string;reason:"field_disagreement"|"omitted_rows"|"unreadable"|"incomplete_extraction"|"classification_unknown";boxes:unknown[]}},jobIds?:string[]){
  const [c,rows,rescuePlans]=await Promise.all([getCase(caseId),jobs(caseId),persistedRescuePlans(caseId)]);
  const scopedRows=jobIds?rows.filter(row=>jobIds.includes(String(row.id))):rows;
  if(jobIds)assertProcessJobRows(jobIds,scopedRows.map(row=>({id:String(row.id),document_id:String(row.documentId),page:Number(row.page),role:String(row.role)})),row=>isCurrentEvidenceJob(row,c,(hash,page)=>samplePageRole(hash,page).role));
  const scopedRescues=jobIds?rescuePlans.filter(plan=>rescuePlanInScope(plan,scopedRows as Array<{id:string;documentId:string;page:number}>,jobIds)):rescuePlans;
  const jobsByStatus:Record<string,number>={};
  for(const row of scopedRows)jobsByStatus[String(row.status)]=(jobsByStatus[String(row.status)]??0)+1;
  const checkStatus:Record<string,number>={};
  for(const check of result.checks??[])checkStatus[String(check.status??"unknown")]=(checkStatus[String(check.status??"unknown")]??0)+1;
  const scopedRemaining=jobIds?scopedRows.filter(row=>["pending","processing","awaiting_upload","error"].includes(String(row.status))&&!['filed_form','administrative'].includes(String(row.role))).length:undefined;
  const remaining=scopedRemaining??result.remaining??rows.filter(row=>["pending","processing","awaiting_upload","error"].includes(String(row.status))&&!['filed_form','administrative'].includes(String(row.role))).length;
  const directRescue=rescuePlanInScope(result.rescue,scopedRows as Array<{id:string;documentId:string;page:number}>,jobIds)?result.rescue:undefined;
  const persistedRescue=directRescue??scopedRescues[0];
  const globalJobsByStatus:Record<string,number>={};for(const row of rows)globalJobsByStatus[String(row.status)]=(globalJobsByStatus[String(row.status)]??0)+1;
  return {caseId,revision:c.context.revision,counts:{documents:c.documents.filter(d=>d.status==="active").length,evidencePages:c.pages.filter(p=>p.role==="evidence").length,facts:c.facts.length,incomes:c.incomes.length,debts:c.debts.length,assets:c.assets.length,transactions:c.transactions.length},jobs:{total:scopedRows.length,byStatus:jobsByStatus,...(jobIds?{globalTotal:rows.length,globalByStatus:globalJobsByStatus}:{}),...(jobIds?{scopeIds:jobIds}:{})},remaining,stage:result.stage??"unknown",...(result.page!==undefined?{page:result.page}:{}),...(result.disagreements!==undefined?{disagreements:result.disagreements}:{}),...(persistedRescue?{rescue:persistedRescue}:{}),...(result.warnings?{warningCount:result.warnings.length}:{}),...(result.checks?{checks:{total:result.checks.length,byStatus:checkStatus}}:{}),...(result.error?{error:result.error}:{})};
}
