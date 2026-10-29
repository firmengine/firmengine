/** SQL-triggered source change detection. Reading this module never calculates,
 * calls a model, acknowledges a change, or grants a review/approval. */
export const CASE_DATA_WATCH_VERSION = "case-data-watch/1";
export const CASE_DATA_QUIET_MS = 10 * 60 * 1000;

type StateRow = {case_id:string;data_version:number;last_event_id:number;last_case_revision:number|null;last_changed_at:string;current_case_revision:number};
type EventRow = {id:number;case_id:string;table_name:string;row_id:string;operation:string;event_kind:string;case_revision:number|null;changed_at:string};

function fault(code:string):Error&{code:string}{return Object.assign(new Error(code),{code});}
function caseId(value:unknown):asserts value is string {
  if(typeof value!=="string"||!value.trim()||value.length>300)throw fault("INVALID_CASE_DATA_WATCH_CASE_ID");
}
function integer(value:unknown,min:number,max:number,code:string):asserts value is number {
  if(typeof value!=="number"||!Number.isSafeInteger(value)||value<min||value>max)throw fault(code);
}
function stateView(row:StateRow) {
  const changedAt=Date.parse(row.last_changed_at);
  if(!Number.isFinite(changedAt))throw fault("CASE_DATA_WATCH_TIMESTAMP_INVALID");
  return {schemaVersion:CASE_DATA_WATCH_VERSION,caseId:row.case_id,dataVersion:row.data_version,lastEventId:row.last_event_id,
    lastCaseRevision:row.last_case_revision,currentCaseRevision:row.current_case_revision,lastChangedAt:row.last_changed_at,
    quietMs:CASE_DATA_QUIET_MS,dueAt:new Date(changedAt+CASE_DATA_QUIET_MS).toISOString(),isQuiet:Date.now()>=changedAt+CASE_DATA_QUIET_MS,
    notificationOnly:true as const,acknowledgesChanges:false as const};
}

/** A migration or case-insert trigger must create the baseline. Missing state
 * is explicit failure rather than a false "no updates" response. */
export async function getCaseDataUpdateState(database:D1Database,input:{caseId:string}) {
  caseId(input.caseId);
  const row=await database.prepare("SELECT s.*,c.revision AS current_case_revision FROM cases c LEFT JOIN case_data_change_state s ON s.case_id=c.id WHERE c.id=?").bind(input.caseId).first<StateRow|null>();
  if(!row)throw fault("CASE_DATA_WATCH_CASE_NOT_FOUND");
  if(!row.case_id||!Number.isSafeInteger(row.data_version)||row.data_version<1)throw fault("CASE_DATA_WATCH_BASELINE_MISSING");
  return stateView(row);
}

/** Monotone event IDs are the pagination cursor. Timestamps are metadata only:
 * several SQL changes in one millisecond still yield distinct detectable events. */
export async function listCaseDataUpdates(database:D1Database,input:{caseId?:string;afterEventId?:number;limit?:number}={}) {
  if(input.caseId!==undefined)caseId(input.caseId);
  const afterEventId=input.afterEventId??0,limit=input.limit??50;
  integer(afterEventId,0,Number.MAX_SAFE_INTEGER,"INVALID_CASE_DATA_WATCH_CURSOR");
  integer(limit,1,200,"INVALID_CASE_DATA_WATCH_LIMIT");
  const scopedState=input.caseId?await getCaseDataUpdateState(database,{caseId:input.caseId}):null;
  const scope=input.caseId?" AND case_id=?":"",scopeArgs=input.caseId?[input.caseId]:[];
  const boundary=await database.prepare("SELECT COALESCE(MAX(id),0) AS id FROM case_data_change_events WHERE 1=1"+scope).bind(...scopeArgs).first<{id:number}>();
  const observedThroughEventId=boundary?.id??0;
  const results=await database.prepare("SELECT id,case_id,table_name,row_id,operation,event_kind,case_revision,changed_at FROM case_data_change_events WHERE id>? AND id<=?"+scope+" ORDER BY id LIMIT ?").bind(afterEventId,observedThroughEventId,...scopeArgs,limit+1).all<EventRow>();
  const rows=(results.results??[]).slice(0,limit),hasMore=(results.results?.length??0)>limit;
  const changedCaseIds=[...new Set(rows.map(row=>row.case_id))];
  const states:ReturnType<typeof stateView>[]=scopedState?[scopedState]:[];
  if(!scopedState)for(let offset=0;offset<changedCaseIds.length;offset+=80){
    const ids=changedCaseIds.slice(offset,offset+80);
    const current=await database.prepare(`SELECT s.*,c.revision AS current_case_revision FROM case_data_change_state s JOIN cases c ON c.id=s.case_id WHERE s.case_id IN (${ids.map(()=>"?").join(",")}) ORDER BY s.last_event_id`).bind(...ids).all<StateRow>();
    states.push(...current.results.map(stateView));
  }
  states.sort((a,b)=>a.lastEventId-b.lastEventId);
  return {schemaVersion:CASE_DATA_WATCH_VERSION,afterEventId,observedThroughEventId,nextAfterEventId:rows.at(-1)?.id??afterEventId,hasMore,limit,
    quietMs:CASE_DATA_QUIET_MS,notificationOnly:true as const,acknowledgesChanges:false as const,
    cursorMeaning:"Append-only SQL event ID; reading does not clear changes. Current states may advance during pagination.",
    events:rows.map(row=>({eventId:row.id,caseId:row.case_id,tableName:row.table_name,rowId:row.row_id,operation:row.operation,eventKind:row.event_kind,caseRevision:row.case_revision,changedAt:row.changed_at})),states};
}
