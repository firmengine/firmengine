import { env } from "cloudflare:workers";
import { db, HttpError, now } from "./server-store";
import { runLegalMonitor, isOfficialMonitorUrl, type MonitorAgent, type MonitorObservation, type MonitorRunResult, type MonitorDiscovery, type MonitorCandidate, type MonitorRuleProjection, type MonitorSource } from "./legal-monitor-core.ts";
import { LEGAL_MONITOR_SOURCES, LEGAL_MONITOR_SOURCE_POLICY } from "./legal-monitor-sources.ts";
import { makeLegalMonitorProvider } from "./legal-monitor-provider.ts";
import { referenceMonitorRules } from "./reference-registry.ts";
import { referenceHash } from "./reference-store.ts";
import { referenceIdentity } from "./reference-runtime.ts";
import { intakeReferenceMonitorScope } from "./intake-reference-store.ts";

type MonitorState={pendingDiscoveries?:MonitorDiscovery[];cursor?:number|null;discoveryUrls?:string[];lastSearchAttemptAt?:string;lastSearchSucceededAt?:string;lastRunAt?:string;lastCompleteSweepAt?:string;sourceHealth?:MonitorRunResult["sourceHealth"]};
const parse=<T>(text:string):T=>JSON.parse(text) as T;
const koreanDay=(at:string)=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(at));

async function monitoredReferenceScope(){
  const intake=await intakeReferenceMonitorScope(db());
  const rules:MonitorRuleProjection[]=[...referenceMonitorRules(),...intake.rules];
  const sources:MonitorSource[]=[...LEGAL_MONITOR_SOURCES],known=new Set(sources.map(source=>source.url));
  for(const rule of rules)for(const url of rule.sourceUrls){
    if(known.has(url)||!isOfficialMonitorUrl(url))continue;
    known.add(url);
    const host=new URL(url).hostname,court=host==="scourt.go.kr"||host.endsWith(".scourt.go.kr"),issuer=host==="gov.kr"||host.endsWith(".gov.kr");
    const attachment=/\.(pdf|hwp|hwpx|docx?|xlsx?)(?:\?|$)/i.test(url),index=court&&/ListAction|[?&](?:mode|view)=list/i.test(url);
    sources.push({id:`reference-${(await referenceHash(url)).slice(0,24)}`,title:rule.title,url,agent:court||issuer?"court_documents":"legislation",kind:attachment?"attachment":issuer?"court_forms":court?index?"court_forms":"court_notice":"law",officialDomains:[host],keywords:[rule.title],discoverLinks:index});
  }
  return {rules,sources,intakeReference:{version:intake.catalogVersion,sha256:intake.catalogSha256,initialized:intake.initialized}};
}

export async function legalMonitorOverview(){
  const {sources,intakeReference}=await monitoredReferenceScope();
  const [states,runs,alerts,counts]=await Promise.all([
    db().prepare("SELECT id,payload,updated_at AS updatedAt FROM legal_monitor_state").all<{id:string;payload:string;updatedAt:string}>(),
    db().prepare("SELECT id,agent,status,started_at AS startedAt,completed_at AS completedAt,payload FROM legal_monitor_runs ORDER BY started_at DESC LIMIT 20").all<{id:string;agent:string;status:string;startedAt:string;completedAt:string|null;payload:string}>(),
    db().prepare("SELECT id,payload,created_at AS createdAt,acknowledged_at AS acknowledgedAt FROM legal_monitor_alerts ORDER BY created_at DESC LIMIT 200").all<{id:string;payload:string;createdAt:string;acknowledgedAt:string|null}>(),
    db().prepare("SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN acknowledged_at IS NULL THEN 1 ELSE 0 END),0) AS unread FROM legal_monitor_alerts").first<{total:number;unread:number}>(),
  ]);
  const state=states.results.map(row=>({id:row.id,...parse<Record<string,unknown>>(row.payload),updatedAt:row.updatedAt}));
  const schedule=state.find(s=>s.id==="schedule") as Record<string,unknown>|undefined;
  const credentials=env as unknown as {LAW_OPEN_DATA_OC?:string};
  return {sources:sources.map(source=>({...source,enabled:source.enabled!==false&&(!source.api||!!credentials.LAW_OPEN_DATA_OC),...(source.api&&!credentials.LAW_OPEN_DATA_OC?{disabledReason:"법제처 API 인증값 미설정 · 공식 공개 페이지와 웹검색은 계속 확인"}:{})})),states:state,runs:runs.results.map(row=>({...row,payload:parse(row.payload)})),alerts:alerts.results.map(row=>({...parse<Record<string,unknown>>(row.payload),id:row.id,createdAt:row.createdAt,acknowledgedAt:row.acknowledgedAt})),counts:counts??{total:0,unread:0},schedule:{cadence:"daily",timezone:"Asia/Seoul",hour:9,notification:"chatgpt_and_in_app",configured:!!schedule?.configured,...schedule},policy:LEGAL_MONITOR_SOURCE_POLICY,referenceRelease:referenceIdentity(),intakeReference};
}

export async function runStoredLegalMonitor(input:{agent?:MonitorAgent|"all";cursor?:number;maxSources?:number}={}){
  const agent=input.agent??"all",startedAt=now(),token=crypto.randomUUID(),runId=crypto.randomUUID();
  if(!["all","legislation","court_documents"].includes(agent))throw new HttpError(400,"감시 에이전트를 확인하세요.");
  if(input.cursor!==undefined&&(!Number.isSafeInteger(input.cursor)||input.cursor<0))throw new HttpError(400,"감시 위치가 올바르지 않습니다.");
  const expires=new Date(Date.now()+150_000).toISOString();
  await db().prepare("INSERT INTO legal_monitor_locks (id,token,expires_at) VALUES ('legal-monitor',?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE legal_monitor_locks.expires_at < ?").bind(token,expires,startedAt).run();
  const lock=await db().prepare("SELECT token FROM legal_monitor_locks WHERE id = 'legal-monitor'").first<{token:string}>();
  if(lock?.token!==token)throw new HttpError(409,"다른 변경 확인 작업이 진행 중입니다. 완료 후 다시 확인하세요.");
  try{
    await db().prepare("INSERT INTO legal_monitor_runs (id,agent,status,started_at,payload) VALUES (?,?,?,?,?)").bind(runId,agent,"running",startedAt,JSON.stringify({referenceRelease:referenceIdentity()})).run();
    const [previousRows,stateRow]=await Promise.all([
      db().prepare("SELECT source_id AS sourceId,payload FROM legal_monitor_observations ORDER BY fetched_at DESC LIMIT 2001").all<{sourceId:string;payload:string}>(),
      db().prepare("SELECT payload FROM legal_monitor_state WHERE id = ?").bind(agent).first<{payload:string}>(),
    ]);
    if(previousRows.results.length>2000)throw new Error("MONITOR_HISTORY_LIMIT_REVIEW_REQUIRED");
    const previous=Object.fromEntries(previousRows.results.map(r=>[r.sourceId,parse<MonitorObservation>(r.payload)]));
    let state=stateRow?parse<MonitorState>(stateRow.payload):{};
    const {rules,sources,intakeReference}=await monitoredReferenceScope(),provider=makeLegalMonitorProvider();
    const searchDue=!state.lastSearchAttemptAt||koreanDay(state.lastSearchAttemptAt)!==koreanDay(startedAt);
    const cursor=input.cursor??(searchDue?0:state.cursor??0);
    const fence="EXISTS (SELECT 1 FROM legal_monitor_locks WHERE id='legal-monitor' AND token=? AND expires_at>?)";
    const persistState=async(value:MonitorState)=>{
      const result=await db().prepare(`INSERT INTO legal_monitor_state (id,payload,updated_at) SELECT ?,?,? WHERE ${fence} ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`).bind(agent,JSON.stringify(value),now(),token,now()).run();
      if(!result.meta.changes)throw new Error("MONITOR_LEASE_LOST");
    };
    // Claim a daily search before the paid call. Its discovered queue is persisted
    // immediately on return, before source fetching can exhaust the request.
    if(searchDue){state={...state,lastSearchAttemptAt:startedAt};await persistState(state);}
    const result=await runLegalMonitor({sources,rules,previous,agent,cursor,now:startedAt,lawOpenDataOc:(env as unknown as {LAW_OPEN_DATA_OC?:string}).LAW_OPEN_DATA_OC,
      discoveryBaselineUrls:state.discoveryUrls,pendingDiscoveries:state.pendingDiscoveries,previousSourceHealth:state.sourceHealth,
      ...(searchDue?{discover:async(context:Parameters<typeof provider.discover>[0])=>{
        const found=await provider.discover(context);
        const existing=state.pendingDiscoveries??[];
        const queued=found.map(item=>({...item,baselineOnly:state.discoveryUrls===undefined,discoveredAt:startedAt}));
        state={...state,lastSearchSucceededAt:now(),pendingDiscoveries:[...new Map([...queued,...existing].map(item=>[item.url,item])).values()]};
        await persistState(state);return found;
      }}:{}),
      analyze:provider.analyze,limits:{maxSources:Math.min(20,Math.max(1,input.maxSources??12)),maxRunMs:50_000,maxAnalyses:2},
    });
    const completedAt=now(),newAlerts:MonitorCandidate[]=[];
    for(const observation of result.observations){
      const related=result.candidates.filter(candidate=>candidate.sourceId===observation.sourceId);
      const historyHash=await referenceHash({sha256:observation.sha256,url:observation.url,attachments:observation.attachments.map(a=>({url:a.url,sha256:a.sha256??null})).sort((a,b)=>a.url.localeCompare(b.url))});
      const at=now(),nextExpiry=new Date(Date.now()+150_000).toISOString();
      // Baseline + every matching alert + history share one D1 transaction.
      // The token fences stale/expired workers before any baseline is advanced.
      const commands=[
        db().prepare("UPDATE legal_monitor_locks SET expires_at=? WHERE id='legal-monitor' AND token=? AND expires_at>?").bind(nextExpiry,token,at),
        db().prepare(`INSERT INTO legal_monitor_observations (source_id,sha256,payload,fetched_at) SELECT ?,?,?,? WHERE ${fence} ON CONFLICT(source_id) DO UPDATE SET sha256=excluded.sha256,payload=excluded.payload,fetched_at=excluded.fetched_at`).bind(observation.sourceId,observation.sha256,JSON.stringify(observation),observation.fetchedAt,token,at),
        db().prepare(`INSERT OR IGNORE INTO legal_monitor_observation_history (source_id,sha256,payload,fetched_at) SELECT ?,?,?,? WHERE ${fence}`).bind(observation.sourceId,historyHash,JSON.stringify(observation),observation.fetchedAt,token,at),
        ...related.map(candidate=>db().prepare(`INSERT OR IGNORE INTO legal_monitor_alerts (id,agent,source_id,status,payload,created_at) SELECT ?,?,?,?,?,? WHERE ${fence}`).bind(candidate.id,candidate.agent,candidate.sourceId,"pending_review",JSON.stringify({...candidate,referenceRelease:referenceIdentity(),intakeReference,createdAt:completedAt}),completedAt,token,at)),
      ];
      const saved=await db().batch(commands);
      if(!saved[0].meta.changes||!saved[1].meta.changes)throw new Error("MONITOR_LEASE_LOST");
      related.forEach((candidate,index)=>{if(saved[index+3].meta.changes)newAlerts.push(candidate);});
    }
    const healthById=new Map((state.sourceHealth??[]).map(h=>[h.sourceId,h]));for(const h of result.sourceHealth)healthById.set(h.sourceId,h);
    const pending=result.pendingDiscoveries??[];
    const readyPending=pending.some(item=>!item.retryAfter||item.retryAfter<=completedAt);
    const continuationCursor=result.nextCursor??(readyPending?result.totalSources:null);
    const baselineEstablished=state.discoveryUrls!==undefined||!!state.lastSearchSucceededAt||result.discoveryStatus==="complete";
    const newState:MonitorState={...state,pendingDiscoveries:pending,cursor:continuationCursor??0,...(baselineEstablished?{discoveryUrls:[...new Set([...(state.discoveryUrls??[]),...result.discoveryUrls])].slice(-2000)}:{}),lastRunAt:completedAt,sourceHealth:[...healthById.values()],...(result.nextCursor===null?{lastCompleteSweepAt:completedAt}:{})};
    const summary={runId,agent,status:result.status,nextCursor:continuationCursor,pendingDiscoveryCount:pending.length,processedSources:result.processedSources,totalSources:result.totalSources,requests:result.requests,bytes:result.bytes,sourceHealth:result.sourceHealth,discoveryStatus:result.discoveryStatus,analysisStatus:result.analysisStatus,newAlerts,newAlertCount:newAlerts.length,observedCount:result.observations.length,usage:provider.usage(),startedAt,completedAt,referenceRelease:referenceIdentity(),intakeReference,automaticRuleActivation:false,caseWrites:0};
    const commitAt=now();
    const final=await db().batch([
      db().prepare(`UPDATE legal_monitor_runs SET status=?,completed_at=?,payload=? WHERE id=? AND ${fence}`).bind(result.status,completedAt,JSON.stringify(summary),runId,token,commitAt),
      db().prepare(`INSERT INTO legal_monitor_state (id,payload,updated_at) SELECT ?,?,? WHERE ${fence} ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`).bind(agent,JSON.stringify(newState),completedAt,token,commitAt),
    ]);
    if(!final[0].meta.changes||!final[1].meta.changes)throw new Error("MONITOR_LEASE_LOST");
    return summary;
  }catch(error){
    const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:"MONITOR_RUN_FAILED";
    await db().prepare("UPDATE legal_monitor_runs SET status='failed',completed_at=?,payload=? WHERE id=?").bind(now(),JSON.stringify({runId,agent,error:code,caseWrites:0,automaticRuleActivation:false}),runId).run();
    throw new HttpError(502,`변경 감시를 완료하지 못했습니다. ${code}`);
  }finally{await db().prepare("DELETE FROM legal_monitor_locks WHERE id='legal-monitor' AND token=?").bind(token).run();}
}

export async function acknowledgeLegalMonitorAlert(id:string,actor:string){
  const result=await db().prepare("UPDATE legal_monitor_alerts SET acknowledged_at=?,acknowledged_by=? WHERE id=? AND acknowledged_at IS NULL").bind(now(),actor,id).run();
  return {id,acknowledged:!!result.meta.changes,legalRuleActivated:false};
}
export async function saveLegalMonitorSchedule(input:{automationId:string;configured:boolean}){
  if(typeof input.automationId!=="string"||input.automationId.length>300)throw new HttpError(400,"예약 실행 식별자를 확인하세요.");
  const value={cadence:"daily",timezone:"Asia/Seoul",hour:9,notification:"chatgpt_and_in_app",configured:input.configured,automationId:input.automationId};
  await db().prepare("INSERT INTO legal_monitor_state (id,payload,updated_at) VALUES ('schedule',?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at").bind(JSON.stringify(value),now()).run();return value;
}
