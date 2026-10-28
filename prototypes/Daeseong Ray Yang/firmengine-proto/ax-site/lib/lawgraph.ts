import exceptions from "./legal-exceptions.json" with { type: "json" };
import { WORKFLOW_RULES } from "./workflow-rules.ts";
import { LEGAL_CATALOG, RULE_RESEARCH_METADATA } from "./legal-rules.ts";
import { CALCULATION_SPECS, EXECUTION_CONTRACT_VERSION, WORKFLOW_CALCULATIONS } from "./execution-catalog.ts";
import { AGENT_NODE_CONTRACTS } from "./case-agent-contracts.ts";

export type ExecutionCategory = "document_route_evaluator" | "deterministic_calculation_source_gate" | "static_only";
export type FeatureMapping = "exact_workflow_key" | "curated_alias" | "unmapped";
export interface GraphNode { id:string; type:string; label:string; metadata?:Record<string,unknown> }
export interface GraphEdge { id:string; from:string; to:string; type:string; metadata?:Record<string,unknown> }
interface CatalogRule { id:string; title:string; article?:string; source_ids?:string[]; implementation_scope?:string; source_url?:string; authority_scope?:string; effective_date?:string }
interface CatalogSource { id:string; title:string; url:string; edition_effective_date?:string; effectiveFrom?:string; authority?:string; status?:string; application_review_required?:boolean }
interface ExceptionScenario { id:string; trigger:string; requiredDocuments:string[]; features:string[]; ruleRefs:string[]; calculation:string; outputTargets:string[]; missingAction:string; decisionBoundary:string; implementedIn:string; coverageGap:string }
interface WFInfo { id:string; title:string; linkTypes:string[] }
export interface LawGraphScenario extends ExceptionScenario {
  executionCategories:ExecutionCategory[];
  featureMappings:{key:string;nodeId:string;status:FeatureMapping;canonicalFeatureId:string|null}[];
  matchedWorkflowRules:WFInfo[];
  sources:{id:string;title:string;url:string;effective:string;scope:string;verification:string;courtApplicability:"unknown_pending_case_court_and_date"}[];
  nodeIds:string[]; edgeIds:string[];
  calculationIds:string[];
}

const catalogRules=LEGAL_CATALOG as CatalogRule[];
const catalogSources=RULE_RESEARCH_METADATA.sources as CatalogSource[];
const exceptionRows=exceptions.scenarios as ExceptionScenario[];
const nodes=new Map<string,GraphNode>();
const edges=new Map<string,GraphEdge>();
function addNode(node:GraphNode):string { const prior=nodes.get(node.id); if(prior && (prior.type!==node.type || prior.label!==node.label)) throw new Error(`Conflicting graph node ${node.id}`); nodes.set(node.id,prior ?? node); return node.id; }
function addEdge(from:string,to:string,type:string,metadata?:Record<string,unknown>):string {
  const id=`edge:${encodeURIComponent(from)}:${type}:${encodeURIComponent(to)}`;
  edges.set(id,{id,from,to,type,...(metadata?{metadata}:{})}); return id;
}
function featureId(key:string){return `workflow-feature:${encodeURIComponent(key)}`;}
function targetId(t:{kind:string;section:string;field:string}){return `target:${encodeURIComponent(`${t.kind}|${t.section}|${t.field}`)}`;}

// Curated executable registrations. Each entry names code actually invoked by the
// corresponding current evaluator path; catalog implementation_scope alone never registers execution.
const curatedRuleExecution:Record<string,{category:ExecutionCategory;functionPath:string;reason:string}>={
  "KR-PR-001":{category:"deterministic_calculation_source_gate",functionPath:"lib/workflow-rules.ts:evaluateWorkflow",reason:"Explicit rule release/application-date gate in legalChecks."},
  "KR-PR-006":{category:"deterministic_calculation_source_gate",functionPath:"lib/workflow-rules.ts:evaluateWorkflow → lib/assessment.ts:assessCase",reason:"findingMap routes cap_담보 assessment finding to this rule check."},
  "KR-PR-007":{category:"deterministic_calculation_source_gate",functionPath:"lib/workflow-rules.ts:evaluateWorkflow → lib/assessment.ts:assessCase",reason:"findingMap routes cap_무담보 assessment finding to this rule check."},
  "KR-PR-041":{category:"deterministic_calculation_source_gate",functionPath:"lib/workflow-rules.ts:evaluateWorkflow → lib/assessment.ts:assessCase",reason:"findingMap routes plan_term assessment finding to this rule check."},
  "KR-PR-043":{category:"deterministic_calculation_source_gate",functionPath:"lib/workflow-rules.ts:evaluateWorkflow → lib/assessment.ts:assessCase",reason:"findingMap routes liquidation assessment finding to this rule check."},
};
const workflowEvaluator={functionPath:"lib/workflow-rules.ts:evaluateWorkflow",category:"document_route_evaluator" as const};
const curatedFeatureAliases:Record<string,{canonicalKey:string;reason:string}>={
  applicationDate:{canonicalKey:"case.applicationDate",reason:"EL-01 applicationDate is the WF-01 신청일·예정일 field."},
  courtId:{canonicalKey:"case.courtId",reason:"EL-01 courtId is the WF-01 관할 법원 field."},
};

// Materialize the real workflow graph: rule → requested document → exact feature key → output target.
const workflowParts=new Map<string,{nodeIds:Set<string>;edgeIds:Set<string>}>();
for(const rule of WORKFLOW_RULES){
  const part={nodeIds:new Set<string>(),edgeIds:new Set<string>()}; workflowParts.set(rule.id,part);
  const ruleNode=addNode({id:`workflow-rule:${rule.id}`,type:"workflow_rule",label:`${rule.id} · ${rule.title}`,metadata:{ruleId:rule.id,missingAction:rule.missingAction,legalReviewRequired:rule.legalReviewRequired}}); part.nodeIds.add(ruleNode);
  for(const cond of rule.activation){
    const fid=addNode({id:featureId(cond.feature),type:"workflow_feature",label:cond.feature,metadata:{key:cond.feature,source:"activation",mappingStatus:"exact_workflow_key"}}); part.nodeIds.add(fid);
    part.edgeIds.add(addEdge(ruleNode,fid,"activates_on",{op:cond.op,value:cond.value ?? null}));
  }
  rule.documents.forEach((doc,di)=>{
    const docNode=addNode({id:`workflow-document:${rule.id}:${di}:${encodeURIComponent(doc.type)}`,type:"workflow_document",label:`${doc.type} · ${doc.label}`,metadata:{ruleId:rule.id,documentType:doc.type,requirement:doc.requirement,why:doc.why,alternatives:doc.alternatives ?? []}}); part.nodeIds.add(docNode);
    part.edgeIds.add(addEdge(ruleNode,docNode,"requires_document"));
    doc.fields.forEach(field=>{
      const fid=addNode({id:featureId(field.key),type:"workflow_feature",label:field.key,metadata:{key:field.key,label:field.label,unit:field.unit ?? null,period:field.period ?? null,crossChecks:field.crossChecks,source:"document_field",mappingStatus:"exact_workflow_key"}}); part.nodeIds.add(fid);
      part.edgeIds.add(addEdge(docNode,fid,"extracts_feature",{label:field.label,unit:field.unit ?? null,period:field.period ?? null,crossChecks:field.crossChecks}));
      field.targets.forEach(target=>{
        const tid=addNode({id:targetId(target),type:"output_target",label:`${target.kind} · ${target.section} · ${target.field}`,metadata:{...target}}); part.nodeIds.add(tid);
        part.edgeIds.add(addEdge(fid,tid,"maps_to_output"));
      });
    });
  });
}

// These are executable tool contracts. Case-specific applicability is still resolved
// from the latest stored case, not inferred from a shared legal-rule reference.
const calculationParts=new Map<string,{nodeIds:Set<string>;edgeIds:Set<string>}>();
for(const calculation of CALCULATION_SPECS){
  const part={nodeIds:new Set<string>(),edgeIds:new Set<string>()};calculationParts.set(calculation.id,part);
  const cid=addNode({id:`calculation:${calculation.id}`,type:"calculation",label:calculation.title,metadata:{...calculation,contractVersion:EXECUTION_CONTRACT_VERSION}});part.nodeIds.add(cid);
  const tool=calculation.id==="disposal_conservation"?"calculate_disposal":["form_projection","installment_distribution"].includes(calculation.id)?"build_document_payload":"calculate_case";
  const tid=addNode({id:`mcp-tool:${tool}`,type:"mcp_tool",label:tool,metadata:{endpoint:"/mcp",readonly:true,dispatcher:"lib/calculator-tools.ts:callCalculatorTool"}});part.nodeIds.add(tid);part.edgeIds.add(addEdge(tid,cid,"executes_calculation"));
  for(const key of calculation.inputs){const fid=addNode({id:`calculation-input:${key}`,type:"calculation_input",label:key,metadata:{key}});part.nodeIds.add(fid);part.edgeIds.add(addEdge(fid,cid,"required_input"));}
  for(const output of calculation.resultPaths){const oid=addNode({id:`calculation-result:${calculation.id}:${output}`,type:"calculation_result",label:output});part.nodeIds.add(oid);part.edgeIds.add(addEdge(cid,oid,"returns_result"));}
  for(const binding of calculation.formBindings){const bid=addNode({id:`form-binding:${binding}`,type:"form_binding",label:binding});part.nodeIds.add(bid);part.edgeIds.add(addEdge(cid,bid,"binds_form_field"));}
  for(const kind of calculation.documents){const did=addNode({id:`artifact:${kind}`,type:"artifact",label:kind});part.nodeIds.add(did);part.edgeIds.add(addEdge(cid,did,"supports_document"));}
}
for(const calculation of CALCULATION_SPECS)for(const dependency of calculation.dependsOn){const part=calculationParts.get(calculation.id)!;part.nodeIds.add(`calculation:${dependency}`);part.edgeIds.add(addEdge(`calculation:${dependency}`,`calculation:${calculation.id}`,"calculation_dependency"));}
for(const [workflowId,ids] of Object.entries(WORKFLOW_CALCULATIONS))for(const calculationId of ids){const part=workflowParts.get(workflowId)!;const calculation=calculationParts.get(calculationId)!;calculation.nodeIds.forEach(id=>part.nodeIds.add(id));calculation.edgeIds.forEach(id=>part.edgeIds.add(id));part.edgeIds.add(addEdge(`workflow-rule:${workflowId}`,`calculation:${calculationId}`,"selects_calculation"));}
for(const node of AGENT_NODE_CONTRACTS){
  const id=addNode({id:`agent:${node.id}`,type:"agent_node",label:node.responsibility,metadata:{...node}});
  const toolId=`mcp-tool:${node.tool}`;
  if(!nodes.has(toolId))addNode({id:toolId,type:node.tool.startsWith("existing_")?"existing_capability":"mcp_tool",label:node.tool,metadata:{readonly:!node.tool.startsWith("existing_")}});
  addEdge(id,toolId,"invokes");
}
addNode({id:"case-database",type:"case_database",label:"사건 DB 최신 판본",metadata:{revisionAndInputHashBound:true}});
addEdge("case-database","agent:case_planner","recheck_after_committed_change");
for(const [from,to] of [["case_planner","source_reconciler"],["source_reconciler","calculator"],["calculator","legal_review"],["calculator","document_binding"],["document_binding","document_review"]])addEdge(`agent:${from}`,`agent:${to}`,"feeds_current_snapshot");
addEdge("agent:case_planner","agent:evidence_collector","requests_missing_features");
addEdge("agent:evidence_collector","case-database","commits_sourced_observations");

const scenarios:LawGraphScenario[]=exceptionRows.map(s=>{
  const localNodes=new Set<string>(); const localEdges=new Set<string>();
  const scenarioNode=addNode({id:`scenario:${s.id}`,type:"exception_scenario",label:`${s.id} · ${s.trigger}`,metadata:{decisionBoundary:s.decisionBoundary,implementedIn:s.implementedIn,coverageGap:s.coverageGap}}); localNodes.add(scenarioNode);
  const wfKeys=new Set<string>();
  const workflowFields=new Set(WORKFLOW_RULES.flatMap(w=>[...w.activation.map(a=>a.feature),...w.documents.flatMap(d=>d.fields.map(f=>f.key))]));
  const featureMappings=s.features.map((key,i)=>{
    const alias=curatedFeatureAliases[key]; const canonicalKey=workflowFields.has(key)?key:alias?.canonicalKey;
    const status:FeatureMapping=workflowFields.has(key)?"exact_workflow_key":canonicalKey&&workflowFields.has(canonicalKey)?"curated_alias":"unmapped";
    const nodeId=addNode({id:`scenario-feature:${s.id}:${i}`,type:"scenario_feature",label:key,metadata:{key,mappingStatus:status,canonicalFeatureKey:status==="unmapped"?null:canonicalKey,aliasReason:status==="curated_alias"?alias.reason:null}}); localNodes.add(nodeId);
    localEdges.add(addEdge(scenarioNode,nodeId,"requires_feature"));
    const canonicalFeatureId=status==="unmapped"?null:featureId(canonicalKey!);
    if(canonicalFeatureId){localNodes.add(canonicalFeatureId); localEdges.add(addEdge(nodeId,canonicalFeatureId,status==="curated_alias"?"curated_alias_maps_to":"exact_key_maps_to",status==="curated_alias"?{reason:alias.reason}:undefined)); wfKeys.add(canonicalKey!);}
    return {key,nodeId,status,canonicalFeatureId};
  });
  s.requiredDocuments.forEach((label,i)=>{const id=addNode({id:`scenario-document:${s.id}:${i}`,type:"required_document",label,metadata:{scenarioId:s.id}});localNodes.add(id);localEdges.add(addEdge(scenarioNode,id,"requires_document"));});
  s.outputTargets.forEach((label,i)=>{const id=addNode({id:`scenario-output:${s.id}:${i}`,type:"scenario_output",label,metadata:{scenarioId:s.id}});localNodes.add(id);localEdges.add(addEdge(scenarioNode,id,"lists_output"));});
  const missing=addNode({id:`missing-action:${s.id}`,type:"missing_document_action",label:s.missingAction,metadata:{scenarioId:s.id}});localNodes.add(missing);localEdges.add(addEdge(scenarioNode,missing,"if_evidence_missing"));

  const related=new Map<string,Set<string>>();
  for(const wf of WORKFLOW_RULES){
    const reasons=new Set<string>();
    if(wf.ruleIds.some(id=>s.ruleRefs.includes(id))) reasons.add("shared_rule_catalog_reference");
    if(wf.activation.some(a=>wfKeys.has(a.feature))||wf.documents.some(d=>d.fields.some(f=>wfKeys.has(f.key)))) reasons.add("exact_or_curated_feature_key");
    if(reasons.size) related.set(wf.id,reasons);
  }
  for(const [wfId,reasons] of related){
    const wfNode=`workflow-rule:${wfId}`; localNodes.add(wfNode);
    const part=workflowParts.get(wfId); part?.nodeIds.forEach(id=>localNodes.add(id)); part?.edgeIds.forEach(id=>localEdges.add(id));
    for(const reason of reasons) localEdges.add(addEdge(scenarioNode,wfNode,reason));
  }
  const linkedSources:string[]=[...new Set(s.ruleRefs.flatMap(id=>catalogRules.find(r=>r.id===id)?.source_ids ?? []))];
  for(const ruleRef of s.ruleRefs){
    const rule=catalogRules.find(r=>r.id===ruleRef);
    const rid=addNode({id:`legal-rule:${ruleRef}`,type:"legal_rule_reference",label:rule?`${rule.id} · ${rule.title}`:`${ruleRef} · catalog reference not found`,metadata:{ruleId:ruleRef,catalogStatus:rule?"found":"unmapped",implementationScope:rule?.implementation_scope ?? "unknown"}});localNodes.add(rid);localEdges.add(addEdge(scenarioNode,rid,"references_rule"));
    for(const sourceId of rule?.source_ids ?? []){const source=catalogSources.find(src=>src.id===sourceId);const sid=addNode({id:`source:${sourceId}`,type:"legal_source",label:source?`${source.id} · ${source.title}`:`${sourceId} · source ID not found`,metadata:source?{url:source.url,effective:source.edition_effective_date ?? source.effectiveFrom ?? "Unknown",scope:source.authority ?? "Unknown",status:source.status ?? "Unknown",applicationReviewRequired:source.application_review_required ?? null,courtApplicability:"unknown_pending_case_court_and_date"}:{status:"unmapped"}});localNodes.add(sid);localEdges.add(addEdge(rid,sid,"cites_source_id"));}
  }
  const executionCategories:ExecutionCategory[]=[];
  if(featureMappings.some(f=>f.status!=="unmapped")) executionCategories.push(workflowEvaluator.category);
  for(const ruleRef of s.ruleRefs) if(curatedRuleExecution[ruleRef]&&!executionCategories.includes(curatedRuleExecution[ruleRef].category)) executionCategories.push(curatedRuleExecution[ruleRef].category);
  if(!executionCategories.length) executionCategories.push("static_only");
  const sources=linkedSources.map(id=>{const src=catalogSources.find(x=>x.id===id);return src?{id:src.id,title:src.title,url:src.url,effective:src.edition_effective_date??src.effectiveFrom??"Unknown",scope:src.authority??"Unknown",verification:src.status??"Unknown",courtApplicability:"unknown_pending_case_court_and_date" as const}:null;}).filter(Boolean) as LawGraphScenario["sources"];
  return {...s,executionCategories,featureMappings,calculationIds:[...new Set([...related.keys()].flatMap(id=>WORKFLOW_CALCULATIONS[id]??[]))],matchedWorkflowRules:[...related].map(([id,linkTypes])=>({id,title:WORKFLOW_RULES.find(w=>w.id===id)?.title??id,linkTypes:[...linkTypes]})),sources,nodeIds:[...localNodes],edgeIds:[...localEdges]};
});

const uniqueSourceIds=[...new Set(catalogRules.flatMap(r=>r.source_ids ?? []))];
const danglingSourceIds=uniqueSourceIds.filter(id=>!catalogSources.some(s=>s.id===id));
export const LAWGRAPH={
  id:"kr-personal-rehabilitation-lawgraph-v3",asOf:exceptions.checkedAt,jurisdiction:exceptions.jurisdiction,
  scope:"Inspectable evidence-to-rule map for research and workflow coverage. Not legal advice, eligibility adjudication, or an automated approval prediction. A workflow link is not proof of execution; only the curated registrations below identify code paths. Court applicability and historical edition selection remain unknown until reviewed for the case.",
  runtimeRuleset:RULE_RESEARCH_METADATA.scope,scenarios,count:scenarios.length,nodes:[...nodes.values()],edges:[...edges.values()],
  ruleCatalog:catalogRules.map(r=>({id:r.id,title:r.title,article:r.article??"Unknown",sourceRefs:r.source_ids??[],implementationScope:r.implementation_scope??"Unknown"})),
  availableWorkflowRules:WORKFLOW_RULES.map(w=>({id:w.id,title:w.title})),
  calculationContracts:CALCULATION_SPECS,agentNodes:AGENT_NODE_CONTRACTS,executionContractVersion:EXECUTION_CONTRACT_VERSION,
  calculatorConnection:{mcpEndpoint:"/mcp",stdioCommand:"npm run mcp:calculator",caseToolInput:["caseId","expectedRevision"],agentExecutor:"lib/case-agent.ts:runCaseCalculatorNode",dispatcher:"lib/calculator-tools.ts:callCalculatorTool",updateHook:"lib/server-store.ts:saveCase",storedEvaluation:"derived_evaluation"},
  curatedExecutionRegistry:{workflowDocumentRoute:workflowEvaluator,featureAliases:curatedFeatureAliases,legalRules:curatedRuleExecution},
  sourceAudit:{catalogSourceCount:catalogSources.length,uniqueRuleReferencedSourceIds:uniqueSourceIds.length,danglingSourceIds,sourceIdsAreExplicit:true,courtApplicability:"unknown_pending_case_court_and_date"},
  sourceScopeNote:"Only explicit legal-catalog source_ids create rule→source edges. Effective edition metadata is not a case-specific applicability decision. Unknown case facts and court scope remain unknown until sourced and reviewed.",
};
export function getLawGraphScenario(id:string){return scenarios.find(s=>s.id===id);}
