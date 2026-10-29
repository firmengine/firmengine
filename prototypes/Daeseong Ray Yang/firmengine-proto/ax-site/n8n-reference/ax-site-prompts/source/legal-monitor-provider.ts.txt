import policies from "./reference-monitor-policies.json" with {type:"json"};
import { readReferenceValue, referenceIdentity } from "./reference-runtime.ts";
import { canonicalMonitorUrl, isOfficialMonitorUrl, OFFICIAL_MONITOR_DOMAINS, type MonitorDiscovery, type MonitorAnalysis, type MonitorRunOptions } from "./legal-monitor-core.ts";
import type { LunaCallArgs, LunaCallResult, Usage } from "./luna.ts";

export interface MonitorProviderUsage {operation:"discover_legislation"|"discover_court_documents"|"discover_all"|"analyze";status:"completed"|"failed"|"aborted";model:"gpt-6-luna";inputTokens:number;outputTokens:number;durationMs:number;acceptedCount?:number;rejectedCount?:number;reason?:"provider_error"|"invalid_result"|"aborted";}
export type MonitorLunaCall=<T>(args:LunaCallArgs)=>Promise<LunaCallResult<T>>;
export const MONITOR_PROMPT_POLICIES=policies.policies;
const limits=policies.limits;
const policyMap=new Map(policies.policies.map(policy=>[policy.id,policy]));
export function monitorPromptPolicy(id:string):string {
  const policy=policyMap.get(id);if(!policy)throw new Error("UNKNOWN_MONITOR_PROMPT_POLICY");
  const value=readReferenceValue<unknown>(id,policy.template);
  if(typeof value!=="string"||policy.lockedSafetyInvariant&&value!==policy.template)throw new Error("MONITOR_PROMPT_SAFETY_INVARIANT_LOCKED");
  return value;
}
const discoverySchema={
  type:"object",additionalProperties:false,required:["discoveries"],
  properties:{discoveries:{type:"array",maxItems:limits.maxDiscoveryResults,items:{
    type:"object",additionalProperties:false,required:["url","title","agent"],
    properties:{url:{type:"string"},title:{type:"string"},agent:{type:"string",enum:["legislation","court_documents"]}},
  }}},
};
const analysisSchema={type:"object",additionalProperties:false,required:["summary","affectedRuleIds","evidence"],properties:{summary:{type:"string"},affectedRuleIds:{type:"array",items:{type:"string"}},evidence:{type:"array",items:{type:"string"}}}};
const defaultCall:MonitorLunaCall=async<T>(args:LunaCallArgs)=>{const {callLuna}=await import("./luna.ts");return callLuna<T>(args);};
const clampText=(value:unknown,limit:number)=>typeof value==="string"?value.slice(0,limit):"";
const safeCount=(value:number|undefined)=>typeof value==="number"&&Number.isFinite(value)&&value>=0?Math.floor(value):0;
function safeUsage(operation:MonitorProviderUsage["operation"],status:MonitorProviderUsage["status"],usage?:Usage):MonitorProviderUsage{return {operation,status,model:"gpt-6-luna",inputTokens:safeCount(usage?.inputTokens),outputTokens:safeCount(usage?.outputTokens),durationMs:safeCount(usage?.durationMs)};}
function abortIfNeeded(signal:AbortSignal){if(signal.aborted)throw new DOMException("Monitor operation aborted","AbortError");}
function discoveryRuleHints(rules:MonitorRunOptions["rules"]):string[]{
  // Keep the current consultation document/rule scope visible even when the
  // larger legal and field-contract catalog fills the bounded search packet.
  const groups=[rules.filter(r=>!r.category.startsWith("intake_")),rules.filter(r=>r.category==="intake_document"),rules.filter(r=>r.category.startsWith("intake_")&&r.category!=="intake_document")].map(group=>[...new Set(group.flatMap(r=>[r.title,...r.keywords??[]]).filter(Boolean))]);
  const hints=new Set<string>();
  for(let i=0;hints.size<limits.maxDiscoveryRuleHints&&groups.some(group=>i<group.length);i++)for(const group of groups){if(group[i]&&hints.size<limits.maxDiscoveryRuleHints)hints.add(group[i]);}
  return [...hints];
}
/** All untrusted source text stays inside input; it is never concatenated into the instructions. */
export function makeLegalMonitorProvider(options:{call?:MonitorLunaCall}={}) {
  const call=options.call??defaultCall,ledger:MonitorProviderUsage[]=[];
  const discover:NonNullable<MonitorRunOptions["discover"]>=async context=>{
    const operation:MonitorProviderUsage["operation"]=context.agent==="all"?"discover_all":context.agent==="legislation"?"discover_legislation":"discover_court_documents";
    let usage:Usage|undefined;
    try{
      abortIfNeeded(context.signal);
      const allowed=context.agent==="court_documents"?["scourt.go.kr","gov.kr"]:context.agent==="legislation"?["law.go.kr","assembly.go.kr","lawmaking.go.kr","scourt.go.kr","mohw.go.kr","moj.go.kr"]:[...OFFICIAL_MONITOR_DOMAINS];
      const instructions=(context.agent==="all"?[monitorPromptPolicy("prompt.monitor.legislation.discovery"),monitorPromptPolicy("prompt.monitor.court_documents.discovery")]:[monitorPromptPolicy(`prompt.monitor.${context.agent}.discovery`)]).join("\n\n");
      const hints=discoveryRuleHints(context.rules);
      const input={kind:"untrusted_monitor_scope",agent:context.agent,since:context.since,checkedAt:new Date().toISOString(),reference:referenceIdentity()??null,sourceList:context.sources.slice(0,limits.maxDiscoverySources).map(source=>({id:source.id,title:source.title,url:source.url,kind:source.kind,court:source.court??null})),ruleKeywords:hints,maximumResults:limits.maxDiscoveryResults};
      const result=await call<{discoveries:unknown[]}>({agent:`legal_monitor_${context.agent}_discovery`,instructions,input:[{role:"user",content:[{type:"input_text",text:JSON.stringify(input)}]}],schema:discoverySchema,maxOutput:limits.discoveryOutputTokens,webSearch:{allowedDomains:allowed},signal:context.signal});
      usage=result.usage;abortIfNeeded(context.signal);
      if(!result.value||!Array.isArray(result.value.discoveries))throw new Error("INVALID_MONITOR_DISCOVERY_RESULT");
      const grounded=new Set((result.sourceUrls??[]).filter(url=>isOfficialMonitorUrl(url,allowed)).map(canonicalMonitorUrl));
      const accepted:MonitorDiscovery[]=[],seen=new Set<string>();let rejected=0;
      for(const raw of result.value.discoveries.slice(0,limits.maxDiscoveryResults*2)){
        if(!raw||typeof raw!=="object"){rejected++;continue;}
        const row=raw as Record<string,unknown>;
        if(typeof row.url!=="string"||typeof row.title!=="string"||!["legislation","court_documents"].includes(String(row.agent))||context.agent!=="all"&&row.agent!==context.agent||!isOfficialMonitorUrl(row.url,allowed)){rejected++;continue;}
        const url=canonicalMonitorUrl(row.url);if(!grounded.has(url)||seen.has(url)||accepted.length>=limits.maxDiscoveryResults){rejected++;continue;}
        seen.add(url);accepted.push({url,title:clampText(row.title,500),agent:row.agent as MonitorDiscovery["agent"]});
      }
      ledger.push({...safeUsage(operation,"completed",usage),acceptedCount:accepted.length,rejectedCount:rejected+Math.max(0,result.value.discoveries.length-limits.maxDiscoveryResults*2)});
      return accepted;
    }catch(error){const aborted=context.signal.aborted||error instanceof Error&&error.name==="AbortError";ledger.push({...safeUsage(operation,aborted?"aborted":"failed",usage),reason:aborted?"aborted":usage?"invalid_result":"provider_error"});if(aborted)throw new DOMException("Monitor operation aborted","AbortError");throw new Error("MONITOR_DISCOVERY_PROVIDER_FAILED");}
  };
  const analyze:NonNullable<MonitorRunOptions["analyze"]>=async context=>{
    let usage:Usage|undefined;
    try{
      abortIfNeeded(context.signal);
      const relatedRules=context.rules.slice(0,limits.maxAnalysisRules).map(rule=>({id:rule.id,title:rule.title,category:rule.category,sourceIds:rule.sourceIds,sourceUrls:rule.sourceUrls})),allowed=new Set(relatedRules.map(rule=>rule.id));
      const sourceProjection=(observation:typeof context.observation|null)=>observation?{url:observation.url,title:observation.title,fetchedAt:observation.fetchedAt,sha256:observation.sha256,rawSha256:observation.rawSha256,textExcerpt:observation.textExcerpt.slice(0,limits.maxSourceExcerptCharacters),attachments:observation.attachments.map(a=>({url:a.url,title:a.title,sha256:a.sha256??null,status:a.status})),effectiveDate:observation.effectiveDate??null,promulgatedDate:observation.promulgatedDate??null}:null;
      const input={kind:"untrusted_official_source_comparison",reference:referenceIdentity()??null,candidate:{id:context.candidate.id,kind:context.candidate.kind,status:context.candidate.status,previousHash:context.candidate.previousHash,currentHash:context.candidate.currentHash,sourceUrls:context.candidate.sourceUrls,requiresHumanReview:true},previous:sourceProjection(context.previous),current:sourceProjection(context.observation),relatedRules};
      const result=await call<MonitorAnalysis>({agent:"legal_monitor_change_analysis",instructions:monitorPromptPolicy("prompt.monitor.change_analysis"),input:[{role:"user",content:[{type:"input_text",text:JSON.stringify(input)}]}],schema:analysisSchema,maxOutput:limits.analysisOutputTokens,signal:context.signal});
      usage=result.usage;abortIfNeeded(context.signal);
      if(!result.value||typeof result.value.summary!=="string"||!Array.isArray(result.value.affectedRuleIds)||!Array.isArray(result.value.evidence))throw new Error("INVALID_MONITOR_ANALYSIS_RESULT");
      const value:MonitorAnalysis={summary:clampText(result.value.summary,4000),affectedRuleIds:[...new Set(result.value.affectedRuleIds.filter(id=>typeof id==="string"&&allowed.has(id)))],evidence:result.value.evidence.filter(v=>typeof v==="string").slice(0,12).map(v=>clampText(v,1200))};
      ledger.push({...safeUsage("analyze","completed",usage),acceptedCount:value.affectedRuleIds!.length,rejectedCount:result.value.affectedRuleIds.length-value.affectedRuleIds!.length});return value;
    }catch(error){const aborted=context.signal.aborted||error instanceof Error&&error.name==="AbortError";ledger.push({...safeUsage("analyze",aborted?"aborted":"failed",usage),reason:aborted?"aborted":usage?"invalid_result":"provider_error"});if(aborted)throw new DOMException("Monitor operation aborted","AbortError");throw new Error("MONITOR_ANALYSIS_PROVIDER_FAILED");}
  };
  return {discover,analyze,usage:()=>ledger.map(row=>({...row}))};
}
