/** Independent, deterministic case-scoped alternative-document monitor.
 * Per-case request visibility is materialized, NEVER the source evidence.
 * No original document, immutable consultation row, or extraction is deleted.
 * A source/policy change immediately makes prior suppression ineligible.
 */
import type { CaseData } from "./domain.ts";
import { buildCaseWorkflowView } from "./case-workflow-view.ts";
import type { SubstitutionView } from "./document-substitution.ts";

export const CASE_SUBSTITUTION_WATCH_VERSION="case-substitution-watch/1" as const;
type Snapshot={caseRevision:number;dataVersion:number};
type DocumentTypeRow={documentId:string;page:number;documentTypeId:string|null};
type StateRow={requirementId:string;decisionStatus:string;activeRequest:number;intakeRunId:string};
type Source={getCase:(id:string)=>Promise<CaseData>;getCatalogVersion:()=>Promise<number>};
const digest=async(value:unknown)=>{
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(x=>x.toString(16).padStart(2,"0")).join("");
};
const iso=()=>new Date().toISOString();
async function snapshot(database:D1Database,caseId:string):Promise<Snapshot>{
 const result=await database.prepare("SELECT c.revision AS caseRevision,COALESCE(s.data_version,0) AS dataVersion FROM cases AS c LEFT JOIN case_data_change_state AS s ON s.case_id=c.id WHERE c.id=?").bind(caseId).first<Snapshot>();
 if(!result)throw new Error("CASE_SUBSTITUTION_CASE_NOT_FOUND");
 return result;
}
async function pageTypes(database:D1Database,caseId:string){
 const rows=(await database.prepare("SELECT source_document_id AS documentId,page,shared_document_type_id AS documentTypeId FROM document_instances WHERE case_id=?").bind(caseId).all<DocumentTypeRow>()).results;
 const grouped=new Map<string,Set<string>>();
 for(const row of rows){
   const key=row.documentId+":"+row.page,values=grouped.get(key)??new Set<string>();
   if(row.documentTypeId)values.add(row.documentTypeId);grouped.set(key,values);
 }
 return [...grouped].map(([key,values])=>({
   documentId:key.slice(0,key.lastIndexOf(":")),
   page:Number(key.slice(key.lastIndexOf(":")+1)),
   documentTypeId:values.size===1?[...values][0]:null
 }));
}
async function policy(database:D1Database){
 const row=await database.prepare("SELECT COUNT(*) AS count,MAX(created_at) AS latest FROM legal_monitor_alerts").first<{count:number;latest:string|null}>();
 const pending=await database.prepare("SELECT COUNT(*) AS count FROM legal_monitor_alerts WHERE acknowledged_at IS NULL").first<{count:number}>();
 return {pending:!!pending?.count,latest:row?.latest??null,signal:(row?.latest??"no-alerts")+":"+(pending?.count??0)};
}
async function activeIntake(database:D1Database,caseId:string){
 const row=await database.prepare("SELECT h.active_run_id AS runId,r.catalog_version AS catalogVersion FROM consultation_heads AS h LEFT JOIN consultation_runs AS r ON r.id=h.active_run_id AND r.status='complete' WHERE h.case_id=?").bind(caseId).first<{runId:string|null;catalogVersion:number|null}>();
 return row??{runId:null,catalogVersion:null};
}
export async function scanCaseSubstitutions(database:D1Database,input:{caseId:string;source:Source}){
 const {caseId}=input;
 if(typeof caseId!=="string"||!caseId.trim()||caseId.length>300)throw new Error("INVALID_CASE_SUBSTITUTION_CASE");
 const before=await snapshot(database,caseId);
 const [data,catalogVersion,courtPolicy,typed,active]=await Promise.all([
   input.source.getCase(caseId),input.source.getCatalogVersion(),policy(database),pageTypes(database,caseId),activeIntake(database,caseId)
 ]);
 if(data.context.id!==caseId||data.context.revision!==before.caseRevision) return {caseId,status:"superseded" as const};
 const projected=await buildCaseWorkflowView(data,{
   catalogVersion,pendingCourtPolicyChange:courtPolicy.pending,pageTypes:typed,
   latestCourtPolicyAlertAt:courtPolicy.latest,activeIntakeRunId:active.runId,
   activeIntakeCatalogVersion:active.catalogVersion
 });
 const requirementIds=new Set((data.workflowState?.requirements??[]).map(r=>r.requirementId));
 if(projected.requirementStates.length!==requirementIds.size||projected.requirementStates.some(item=>!requirementIds.has(item.requirementId)))throw new Error("CASE_SUBSTITUTION_PROJECTION_INCOMPLETE");
 const previous=(await database.prepare("SELECT requirement_id AS requirementId,decision_status AS decisionStatus,active_request AS activeRequest,intake_run_id AS intakeRunId FROM case_substitution_request_states WHERE case_id=?").bind(caseId).all<StateRow>()).results;
 const prior=new Map(previous.map(row=>[row.requirementId,row]));
 const after=await snapshot(database,caseId);
 if(after.caseRevision!==before.caseRevision||after.dataVersion!==before.dataVersion)return {caseId,status:"superseded" as const};
 const now=iso(),caseGuard="EXISTS (SELECT 1 FROM cases c LEFT JOIN case_data_change_state s ON s.case_id=c.id WHERE c.id=? AND c.revision=? AND COALESCE(s.data_version,0)=?)";
 const prepared:D1PreparedStatement[]=[];
 let transitions=0,deactivated=0,restored=0;
 for(const state of projected.requirementStates){
   const requirement=data.workflowState!.requirements.find(r=>r.requirementId===state.requirementId)!;
   const view=state.substitution;
   // A stale consultation or a manually retired request must not be hidden by an
   // old approval. Other reviewers' waiver/nonapplicability states are untouched.
   const activeRequest=requirement.retired?false:view.activeRequest;
   const status=requirement.retired?"original_required":view.status;
   const reasons=requirement.retired?["RETIRED_BY_HUMAN"]:view.reasonCodes;
   const fingerprint=await digest({v:CASE_SUBSTITUTION_WATCH_VERSION,caseId,caseRevision:before.caseRevision,dataVersion:before.dataVersion,
     catalogVersion,policySignal:courtPolicy.signal,requirementId:state.requirementId,
     intakeRunId:requirement.intakeRunId,originalId:view.originalDocumentTypeId,status,activeRequest,reasons,
     proofs:view.supportDocumentIds,missingFields:view.missingFields});
   const old=prior.get(state.requirementId);
   if(!old||old.activeRequest!==Number(activeRequest)||old.decisionStatus!==status){
     transitions++;
     if(old?.activeRequest!==0&&!activeRequest)deactivated++;
     if(old?.activeRequest===0&&activeRequest)restored++;
     prepared.push(database.prepare(`INSERT OR IGNORE INTO case_substitution_transition_events
      (case_id,requirement_id,original_document_type_id,from_status,to_status,from_active_request,to_active_request,case_revision,source_data_version,dependency_fingerprint,reason_codes_json,occurred_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ${caseGuard}`).bind(caseId,requirement.requirementId,view.originalDocumentTypeId,
       old?.decisionStatus??null,status,old?.activeRequest??null,Number(activeRequest),before.caseRevision,before.dataVersion,fingerprint,JSON.stringify(reasons),now,
       caseId,before.caseRevision,before.dataVersion));
   }
   prepared.push(database.prepare(`INSERT INTO case_substitution_request_states
     (case_id,requirement_id,intake_run_id,original_document_type_id,decision_status,active_request,missing_fields_json,reason_codes_json,support_document_ids_json,evaluated_fingerprint,case_revision,source_data_version,catalog_version,evaluated_at)
     SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${caseGuard}
     ON CONFLICT(case_id,requirement_id) DO UPDATE SET
     intake_run_id=excluded.intake_run_id,original_document_type_id=excluded.original_document_type_id,decision_status=excluded.decision_status,active_request=excluded.active_request,
     missing_fields_json=excluded.missing_fields_json,reason_codes_json=excluded.reason_codes_json,support_document_ids_json=excluded.support_document_ids_json,
     evaluated_fingerprint=excluded.evaluated_fingerprint,case_revision=excluded.case_revision,source_data_version=excluded.source_data_version,catalog_version=excluded.catalog_version,evaluated_at=excluded.evaluated_at
     `).bind(caseId,requirement.requirementId,requirement.intakeRunId,view.originalDocumentTypeId,status,Number(activeRequest),
       JSON.stringify(view.missingFields),JSON.stringify(reasons),JSON.stringify(view.supportDocumentIds),fingerprint,before.caseRevision,before.dataVersion,catalogVersion,now,
       caseId,before.caseRevision,before.dataVersion));
 }
 const sorted=[...requirementIds].sort();
 prepared.push(database.prepare(`INSERT INTO case_substitution_watch_heads(case_id,case_revision,source_data_version,catalog_version,policy_signal,active_requirement_ids_json,next_scan_at,scanned_at)
   SELECT ?,?,?,?,?,?,NULL,? WHERE ${caseGuard}
   ON CONFLICT(case_id) DO UPDATE SET case_revision=excluded.case_revision,source_data_version=excluded.source_data_version,catalog_version=excluded.catalog_version,policy_signal=excluded.policy_signal,active_requirement_ids_json=excluded.active_requirement_ids_json,scanned_at=excluded.scanned_at`)
   .bind(caseId,before.caseRevision,before.dataVersion,catalogVersion,courtPolicy.signal,JSON.stringify(sorted),now,caseId,before.caseRevision,before.dataVersion));
 await database.batch(prepared);
 const current=await snapshot(database,caseId);
 if(current.caseRevision!==before.caseRevision||current.dataVersion!==before.dataVersion)return {caseId,status:"superseded" as const};
 return {caseId,status:"scanned" as const,requirements:projected.requirementStates.length,deactivated,restored,transitions,
  active:projected.requirementStates.filter(item=>item.substitution.activeRequest).length,catalogVersion,sourceDataVersion:before.dataVersion,caseRevision:before.caseRevision};
}
export async function drainCaseSubstitutionWatch(database:D1Database,input:{caseId?:string;limit?:number;source:Source}){
 const limit=Math.max(1,Math.min(input.limit??3,5));
 const head=(await database.prepare("SELECT version AS version FROM intake_catalog_head WHERE id='default'").first<{version:number}>())?.version??0;
 const policyNow=await policy(database);
 const scanBefore=new Date(Date.now()-600_000).toISOString();
 const sql=`SELECT c.id AS caseId FROM cases c LEFT JOIN case_data_change_state s ON s.case_id=c.id
   LEFT JOIN case_substitution_watch_heads w ON w.case_id=c.id
   WHERE (w.case_id IS NULL OR w.case_revision<>c.revision OR w.source_data_version<>COALESCE(s.data_version,0)
   OR w.catalog_version<>? OR w.policy_signal<>? OR w.scanned_at<?)
   ${input.caseId?"AND c.id=?":""}
   ORDER BY c.updated_at,c.id LIMIT ?`;
 const rows=(await database.prepare(sql).bind(head,policyNow.signal,scanBefore,...(input.caseId?[input.caseId]:[]),limit).all<{caseId:string}>()).results;
 const results=[];
 for(const row of rows){
  try{results.push(await scanCaseSubstitutions(database,{caseId:row.caseId,source:input.source}));}
  catch(error){results.push({caseId:row.caseId,status:"failed" as const,error:error instanceof Error?error.message:"CASE_SUBSTITUTION_SCAN_FAILED"});}
 }
 return {scanned:rows.length,deactivated:results.reduce((sum,r)=>sum+("deactivated" in r&&typeof r.deactivated==="number"?r.deactivated:0),0),
   restored:results.reduce((sum,r)=>sum+("restored" in r&&typeof r.restored==="number"?r.restored:0),0),results};
}
