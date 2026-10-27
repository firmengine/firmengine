import { assessCase } from "./assessment";
import { CURRENT_RULESET, LEGAL_CATALOG, RISK_CATALOG } from "./legal-rules";
import { caseExtras, getCase, jobs } from "./server-store";
import type { CaseData } from "./domain";
import { evaluateWorkflow } from "./workflow-rules";
import { scanTransactions } from "./transaction-review";
import { applyProcessingGate } from "./processing-readiness";
export async function caseResponse(data:CaseData|string){
  const c=typeof data==="string"?await getCase(data):data;
  const extras=await caseExtras(c);
  const assessment=assessCase(c,CURRENT_RULESET);
  const documents=c.documents.map(document=>{const rows=extras.jobs.filter(j=>j.documentId===document.id);const active=rows.filter(j=>!["held","withdrawn"].includes(String(j.status)));const extractionStatus=active.some(j=>["error","review_required"].includes(String(j.status)))?"failed":active.some(j=>j.status==="processing")?"processing":rows.length&&active.every(j=>j.status==="completed")?"completed":"pending";return {...document,extractionStatus};});
  return {case:{...c,documents,execution:extras.execution??c.execution},assessment:applyProcessingGate(assessment,extras.processingReadiness),...extras,workflow:evaluateWorkflow(c,assessment),transactionReview:scanTransactions(c),rules:CURRENT_RULESET,legalCatalog:LEGAL_CATALOG,riskCatalog:RISK_CATALOG};
}

export async function caseProgress(caseId:string,result:{remaining?:number;stage?:string;page?:number;error?:string;warnings?:unknown[];checks?:{status?:string}[];disagreements?:number}){
  const [c,rows]=await Promise.all([getCase(caseId),jobs(caseId)]);
  const jobsByStatus:Record<string,number>={};
  for(const row of rows)jobsByStatus[String(row.status)]=(jobsByStatus[String(row.status)]??0)+1;
  const checkStatus:Record<string,number>={};
  for(const check of result.checks??[])checkStatus[String(check.status??"unknown")]=(checkStatus[String(check.status??"unknown")]??0)+1;
  const remaining=result.remaining??rows.filter(row=>["pending","processing","awaiting_upload","error"].includes(String(row.status))&&!['filed_form','administrative'].includes(String(row.role))).length;
  return {caseId,revision:c.context.revision,counts:{documents:c.documents.filter(d=>d.status==="active").length,evidencePages:c.pages.filter(p=>p.role==="evidence").length,facts:c.facts.length,incomes:c.incomes.length,debts:c.debts.length,assets:c.assets.length,transactions:c.transactions.length},jobs:{total:rows.length,byStatus:jobsByStatus},remaining,stage:result.stage??"unknown",...(result.page!==undefined?{page:result.page}:{}),...(result.disagreements!==undefined?{disagreements:result.disagreements}:{}),...(result.warnings?{warningCount:result.warnings.length}:{}),...(result.checks?{checks:{total:result.checks.length,byStatus:checkStatus}}:{}),...(result.error?{error:result.error}:{})};
}
