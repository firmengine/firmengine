/** Case-specific scope for legal-reference monitor alerts. Monitoring detects
 * candidates, not legally effective amendments. Unknown scope always blocks,
 * but an explicit different-court notice cannot hold unrelated cases hostage.
 * All dispositions still require human source/date/court verification.
 */
import {LEGAL_MONITOR_SOURCES} from "./legal-monitor-sources.ts";
export const CASE_POLICY_ALERT_SCOPE_VERSION="court-policy-alert-scope/1" as const;
export interface GroupedLegalAlert{
 sourceId:string;agent:string;pending:number;total:number;latest:string|null;
}
export type AlertApplicability="national_or_unknown"|"specific_court";
const courts:Readonly<Record<string,string>>={
 "서울회생법원":"seoul","부산회생법원":"busan","수원회생법원":"suwon",
 "대구회생법원":"daegu","대전회생법원":"daejeon","광주회생법원":"gwangju"
};
function courtOfSource(sourceId:string,agent:string):{applicability:AlertApplicability;courtId:string|null;reason:string}{
 if(agent!=="court_documents")return {applicability:"national_or_unknown",courtId:null,reason:"LEGISLATION_OR_UNKNOWN_AGENT"};
 const direct=LEGAL_MONITOR_SOURCES.filter(source=>source.id===sourceId||
    sourceId.startsWith(source.id+":document:"));
 const sources=direct.length?direct:LEGAL_MONITOR_SOURCES.filter(source=>source.sourceAliases?.includes(sourceId));
 if(!sources.length)return {applicability:"national_or_unknown",courtId:null,reason:"MONITOR_SOURCE_SCOPE_NOT_REGISTERED"};
 const scoped=sources.map(source=>source.court?courts[source.court]??null:null);
 // Court-form lists, ambiguous aliases, or a lack of registered court metadata
 // are never accepted as evidence that a legal rule is local to one court.
 if(scoped.some(v=>v===null)||new Set(scoped).size!==1)
   return {applicability:"national_or_unknown",courtId:null,reason:"COURT_SCOPE_NOT_EXCLUSIVELY_VERIFIED"};
 return {applicability:"specific_court",courtId:scoped[0]!,reason:"REGISTERED_EXACT_COURT_SOURCE"};
}
export function evaluateCasePolicyAlerts(input:{courtId:string;groups:readonly GroupedLegalAlert[];truncated?:boolean}){
 const applied:GroupedLegalAlert[]=[],ignored:GroupedLegalAlert[]=[],scopes:{sourceId:string;courtId:string|null;reason:string}[]=[];
 const validCourt=Object.values(courts).includes(input.courtId);
 for(const row of input.groups){
  const s=courtOfSource(row.sourceId,row.agent);
  const belongs=!validCourt||s.applicability==="national_or_unknown"||s.courtId===input.courtId;
  (belongs?applied:ignored).push(row);
  scopes.push({sourceId:row.sourceId,courtId:s.courtId,reason:s.reason});
 }
 const pending=applied.reduce((n,row)=>n+Math.max(0,row.pending),0);
 const latest=applied.map(row=>row.latest).filter((v):v is string=>typeof v==="string"&&v.length>0).sort().at(-1)??null;
 const scopeOverflow=input.truncated===true;
 return {schemaVersion:CASE_POLICY_ALERT_SCOPE_VERSION,caseCourtId:input.courtId||"unknown",
  pending:pending>0||scopeOverflow,pendingCount:pending,latest,
  signal:JSON.stringify({version:CASE_POLICY_ALERT_SCOPE_VERSION,court:input.courtId,pending,
    latest,scopeOverflow}),
  unknownScopeBlocksAll:!validCourt||scopeOverflow||applied.some(row=>
     courtOfSource(row.sourceId,row.agent).applicability==="national_or_unknown"&&row.pending>0),
  unrelatedCourtAlertCount:ignored.reduce((n,row)=>n+Math.max(0,row.pending),0),
  applicableSources:applied.length,ignoredSources:ignored.length,
  checkedSourceScopes:scopes,legalChangeApproved:false as const};
}
export async function readCasePolicyAlerts(database:D1Database,courtId:string){
 try{
  const rows=await database.prepare(
   "SELECT agent,source_id AS sourceId,COUNT(*) AS total,"+
   "SUM(CASE WHEN acknowledged_at IS NULL THEN 1 ELSE 0 END) AS pending,"+
   "MAX(created_at) AS latest FROM legal_monitor_alerts "+
   "GROUP BY agent,source_id ORDER BY agent,source_id LIMIT 1001"
  ).all<GroupedLegalAlert>();
  const result=rows.results??[],limited=result.length>1000;
  return evaluateCasePolicyAlerts({courtId,groups:result.slice(0,1000),truncated:limited});
 }catch(error){
  // Historical/test DB without source/court metadata: fall back to the old
  // global block. Never silently clear unreviewed law changes.
  const global=await database.prepare(
   "SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN acknowledged_at IS NULL THEN 1 ELSE 0 END),0) AS pending,MAX(created_at) AS latest FROM legal_monitor_alerts"
  ).first<{total:number;pending:number;latest:string|null}>();
  return evaluateCasePolicyAlerts({courtId,groups:[{
   sourceId:"unknown-legacy-schema",agent:"unknown",pending:global?.pending??0,
   total:global?.total??0,latest:global?.latest??null
  }]});
 }
}
