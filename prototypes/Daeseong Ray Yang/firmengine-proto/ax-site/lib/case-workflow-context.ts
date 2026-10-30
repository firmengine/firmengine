/** One server-derived requirement/substitution context for staff UI,
 * automatic LawGraph and final export. No caller may omit current consultation,
 * page family and legal-policy signals; court-specific alert routing is deferred.
 */
import type {CaseData} from "./domain.ts";
import {buildCaseWorkflowView} from "./case-workflow-view.ts";
import {getIntakeCatalog} from "./intake-store.ts";
import {readCasePolicyAlerts} from "./case-policy-alert-scope.ts";
export interface WorkflowDocumentTypeRow {documentId:string;page:number;documentTypeId:string|null}
export interface CaseWorkflowContext {
 catalogVersion:number;
 pendingCourtPolicyChange:boolean;
 latestCourtPolicyAlertAt:string|null;
 activeIntakeRunId:string|null;
 activeIntakeCatalogVersion:number|null;
 pageTypes:{documentId:string;page:number;documentTypeId:string|null}[];
}
export function collectCaseWorkflowPageTypes(rows:readonly WorkflowDocumentTypeRow[]){
 const observed=new Map<string,Set<string>>();
 for(const row of rows){
  if(typeof row.documentId!=="string"||!row.documentId||!Number.isSafeInteger(row.page)||row.page<1)throw new Error("INVALID_WORKFLOW_PAGE_SCOPE");
  const key=row.documentId+":"+row.page,values=observed.get(key)??new Set<string>();
  if(row.documentTypeId)values.add(row.documentTypeId);
  observed.set(key,values);
 }
 return [...observed].map(([key,ids])=>({
  documentId:key.slice(0,key.lastIndexOf(":")),
  page:Number(key.slice(key.lastIndexOf(":")+1)),
  documentTypeId:ids.size===1?[...ids][0]:null
 }));
}
export async function currentCaseWorkflowContext(database:D1Database,caseId:string,
 catalogVersion?:number,courtId?:string):Promise<CaseWorkflowContext>{
 if(!caseId||caseId.length>300)throw new Error("INVALID_CASE_WORKFLOW_CONTEXT");
 const [catalog,documentTypes,policy,consultation]=await Promise.all([
  catalogVersion===undefined?getIntakeCatalog().then(x=>x.catalog.version):Promise.resolve(catalogVersion),
  database.prepare("SELECT source_document_id AS documentId,page,shared_document_type_id AS documentTypeId FROM document_instances WHERE case_id=?")
   .bind(caseId).all<WorkflowDocumentTypeRow>(),
  readCasePolicyAlerts(database,courtId??""),
  database.prepare("SELECT h.active_run_id AS runId,r.catalog_version AS catalogVersion FROM consultation_heads h "+
   "LEFT JOIN consultation_runs r ON r.id=h.active_run_id AND r.status='complete' AND r.case_id=h.case_id WHERE h.case_id=?")
   .bind(caseId).first<{runId:string|null;catalogVersion:number|null}>()
 ]);
 if(!Number.isSafeInteger(catalog)||catalog<1)throw new Error("INVALID_INTAKE_CATALOG_VERSION");
 return {catalogVersion:catalog,pendingCourtPolicyChange:policy.pending,
  latestCourtPolicyAlertAt:policy?.latest??null,
  activeIntakeRunId:consultation?.runId??null,
  activeIntakeCatalogVersion:consultation?.catalogVersion??null,
  pageTypes:collectCaseWorkflowPageTypes(documentTypes.results??[])};
}
export async function buildCurrentCaseWorkflowView(database:D1Database,data:CaseData,
 catalogVersion?:number){
 const options=await currentCaseWorkflowContext(database,data.context.id,catalogVersion,
   String(data.context.courtId??""));
 return buildCaseWorkflowView(data,options);
}
