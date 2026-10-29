import { renderPromptPolicy } from "./reference-prompts.ts";
import { assessCase, sourceFactMoneyValue, type Assessment } from "./assessment.ts";
import { currentFacts, factSourceLineageIssues, moneyValue, normalizeMoney, requiredKindsForCase, type CaseData, type ArtifactKind, type NumericInput } from "./domain.ts";
import { evaluateWorkflow, WORKFLOW_RULES } from "./workflow-rules.ts";
import { documentFieldContract } from "./document-agent-registry.ts";
import { CURRENT_RULESET, LEGAL_CATALOG } from "./legal-rules.ts";
import { CALCULATION_SPECS, EXECUTION_CONTRACT_VERSION, WORKFLOW_CALCULATIONS } from "./execution-catalog.ts";
import { buildFormBindings } from "./form-mapping.ts";
import { buildLegalProposals } from "./legal-proposals.ts";
import { expandPaymentSchedule } from "./payment-schedule.ts";
import { scanTransactions } from "./transaction-review.ts";
import { buildCourtPackage } from "./exports.ts";
import { calculateDisposal } from "./assessment.ts";

type Workflow = ReturnType<typeof evaluateWorkflow>;
const unique = <T>(items:T[]) => [...new Set(items)];
export { AGENT_NODE_CONTRACTS } from "./case-agent-contracts.ts";
import { AGENT_NODE_CONTRACTS } from "./case-agent-contracts.ts";

function routeState(item:Workflow["items"][number]) {
  if(item.applicability==="not_applicable") return "not_applicable" as const;
  if(item.applicability==="conflict") return "conflict" as const;
  const any=item.activationChecks.some(c=>c.matches===true), all=item.activationChecks.every(c=>c.matches===true);
  // A typed hint may select a candidate path without becoming accepted evidence.
  const mode=WORKFLOW_RULES.find(rule=>rule.id===item.ruleId)?.activationMode;
  if(all || mode==="any"&&any) return item.applicability==="pass"?"confirmed":"candidate";
  return "needs_qualification" as const;
}
function closure(selected:Set<string>) {
  for(const id of selected) {
    const spec=CALCULATION_SPECS.find(s=>s.id===id);
    if(!spec) throw new Error(`Unknown calculation contract: ${id}`);
    for(const dependency of spec.dependsOn) selected.add(dependency);
  }
  return CALCULATION_SPECS.filter(s=>selected.has(s.id));
}

/** One plan feeds the UI, agent packet, offline evaluation and MCP. No state mutation. */
export function buildCaseExecutionPlan(data:CaseData, assessment:Assessment=assessCase(data,CURRENT_RULESET), workflow:Workflow=evaluateWorkflow(data,assessment)) {
  const scenarios=Array.isArray(data.disposalScenarios)?data.disposalScenarios:[];
  const routes=workflow.items.map(item=>{
    const baseState=routeState(item);
    const scenarioContradictsFalse=item.ruleId==="WF-40"&&scenarios.length>0&&item.activationChecks.some(check=>check.feature==="case.disposals"&&check.actualValue===false);
    // A typed scenario may select a candidate path only while activation is unknown.
    // Explicit false and conflict results remain authoritative.
    const state=scenarioContradictsFalse?"conflict":item.ruleId==="WF-40"&&scenarios.length>0&&baseState==="needs_qualification"&&item.activationChecks.every(check=>check.matches===null)?"candidate":baseState;
    return {workflowId:item.ruleId,subjectId:item.subjectId,state,activation:item.activationChecks,ruleIds:item.ruleIds,calculationIds:[...(WORKFLOW_CALCULATIONS[item.ruleId]??[])]};
  });
  const selected=new Set(routes.filter(r=>r.state==="candidate"||r.state==="confirmed").map(r=>`${r.workflowId}:${r.subjectId}`));
  const active=workflow.items.filter(item=>selected.has(item.id));
  const calculations=closure(new Set(active.flatMap(item=>[...(WORKFLOW_CALCULATIONS[item.ruleId]??[])])));
  const evidenceRequests=active.flatMap(item=>item.documents.map(document=>{
    const contract=documentFieldContract(document.type);
    return {
      id:`${item.id}:${document.type}`,workflowId:item.ruleId,subjectId:item.subjectId,
      applicability:routeState(item),documentType:document.type,label:document.label,
      alternatives:document.alternatives??[],requirement:document.requirement,reason:document.why,
      sourceFamilyId:contract?.family_id??null,
      // Family contracts preserve all source observations. A source field is not
      // automatically a legally recognized calculation input.
      extractionFieldIds:contract?.fields.map(field=>field.global_field_id)??[],
      extractionRoute:contract?"family_extractor":"document_family_mapping_required",
      fields:document.fields.map(field=>({key:field.key,label:field.label,unit:field.unit??null,period:field.period??null,status:field.status,value:field.value,factIds:field.factIds,refs:field.refs,targets:field.targets,crossChecks:field.crossChecks})),
    };
  }));
  const artifactKinds=requiredKindsForCase(data);
  const documents=artifactKinds.map(kind=>({kind,
    fields:evidenceRequests.flatMap(request=>request.fields.flatMap(field=>field.targets.filter(target=>target.kind===kind).map(target=>({section:target.section,field:target.field,feature:field.key,subjectId:request.subjectId,evidenceRequestId:request.id,status:field.status,factIds:field.factIds})))),
    calculationIds:calculations.filter(calc=>calc.documents.includes(kind)).map(calc=>calc.id),
  }));
  const ruleIds=new Set(active.flatMap(item=>item.ruleIds));
  const legalTasks=LEGAL_CATALOG.map(rule=>({id:rule.id,title:rule.title,node:"legal_review",state:ruleIds.has(rule.id)?"selected_for_review":"qualification_pending",requiredFeatures:rule.required_features,implementationScope:rule.implementation_scope,sourceUrl:rule.source_url,condition:rule.condition,automaticCourtDecision:false}));
  const allFacts=currentFacts(data);
  const normalize=(key:string)=>key.replace(/[A-Z]/g,x=>"_"+x.toLowerCase());
  const calculationTasks=calculations.map(calc=>({...calc,node:"calculator",tool:calc.executor==="calculateDisposal"?"calculate_disposal":["buildFormBindings","proposedInstallmentAnnex"].includes(calc.executor)?"build_document_payload":"calculate_case",snapshot:{caseId:data.context.id,revision:data.context.revision,ruleReleaseId:data.context.ruleReleaseId},featureEvidence:calc.inputs.map(key=>({key,factIds:allFacts.filter(f=>normalize(f.key)===normalize(key)).map(f=>f.id),sourceOfValue:key.startsWith("context.")?"case_context":/recogn|classif|priority|protected|Review|Basis|seoul424/.test(key)?"source_and_decision_input":"source_input",missingIsZero:false})),evaluation:"engine_checks_alternatives_and_missing_inputs",dependencyIds:calc.dependsOn}));
  return {
    version:EXECUTION_CONTRACT_VERSION,caseId:data.context.id,caseRevision:data.context.revision,
    ruleReleaseId:CURRENT_RULESET.id,requestedRuleReleaseId:data.context.ruleReleaseId,
    ruleVersionMatches:data.context.ruleReleaseId===CURRENT_RULESET.id,
    nodes:AGENT_NODE_CONTRACTS,routes,documents,evidenceRequests,calculationTasks,legalTasks,
    qualificationRequests:routes.filter(r=>["needs_qualification","conflict"].includes(r.state)).map(r=>({workflowId:r.workflowId,subjectId:r.subjectId,features:r.workflowId==="WF-40"&&scenarios.length?["case.disposals"]:r.activation.filter(a=>a.matches===null||a.status!=="pass").map(a=>a.feature),state:r.state})),
    generationGate:assessment.generationGate,
    limitations:{legalRecognitionIsSeparate:true,courtApprovalInferred:false,unmappedSourceFamilies:unique(evidenceRequests.filter(r=>!r.sourceFamilyId).map(r=>r.documentType)),unimplementedLegalRulesRemainReviewTasks:true},
  };
}

export function executeCaseNodes(data:CaseData,options:{includeDocumentBindings?:boolean}={}) {
  const scenarios=Array.isArray(data.disposalScenarios)?data.disposalScenarios:[];
  const assessment=assessCase(data,CURRENT_RULESET);
  const workflow=evaluateWorkflow(data,assessment);
  const plan=buildCaseExecutionPlan(data,assessment,workflow);
  const proposals=buildLegalProposals(data);
  const schedule=data.context.paymentSchedule ? expandPaymentSchedule(data.context.paymentSchedule.phases,data.context.paymentSchedule.expectedInstallments??undefined) : null;
  const disposalRoute=plan.routes.find(route=>route.workflowId==="WF-40");
  const disposalActive=disposalRoute?.state==="candidate"||disposalRoute?.state==="confirmed";
  const disposalBlockedByRoute=disposalRoute?.state==="conflict"||disposalRoute?.state==="not_applicable";
  const activeFacts=currentFacts(data);
  const disposalResults=disposalActive||scenarios.length>0?(scenarios.length?scenarios.map(scenario=>{
    if(!scenario||typeof scenario!=="object"||typeof scenario.id!=="string"||typeof scenario.assetId!=="string"||!Array.isArray(scenario.factIds)){
      return {scenarioId:null,assetId:null,tool:"calculate_disposal" as const,status:"blocked" as const,calculation:{saleWon:null,payoffWon:null,costsWon:null,netProceedsWon:null,successorCashWon:null,shortfallWon:null,conserved:false,status:"needs_evidence" as const},reasons:["DISPOSAL_SCENARIO_MALFORMED"],factIds:[],recognition:"unreviewed" as const,courtApprovalInferred:false as const,disposalApprovalInferred:false as const};
    }
    const reasons:string[]=[];
    if(disposalBlockedByRoute)reasons.push("DISPOSAL_CASE_STATUS_CONFLICT");
    const assetExists=data.assets.some(asset=>asset.id===scenario.assetId);
    if(!assetExists)reasons.push("DISPOSAL_ASSET_NOT_FOUND");
    if(scenario.intent!=="proposed")reasons.push("DISPOSAL_INTENT_MISSING");
    if(scenario.recognition==="rejected")reasons.push("DISPOSAL_SCENARIO_REJECTED");
    const inputs={saleAmount:scenario.saleAmount,securedPayoff:scenario.securedPayoff,costs:scenario.costs};
    const expectedKeys={saleAmount:"disposal.saleAmount",securedPayoff:"disposal.securedPayoff",costs:"disposal.costs"} as const;
    for(const [field,key] of Object.entries(expectedKeys) as [keyof typeof expectedKeys,typeof expectedKeys[keyof typeof expectedKeys]][]){
      const amount=moneyValue(inputs[field]);
      if(amount===null){reasons.push(`DISPOSAL_${field.toUpperCase()}_MISSING_OR_INVALID`);continue;}
      if(amount<0n){reasons.push(`DISPOSAL_${field.toUpperCase()}_MISSING_OR_INVALID`);continue;}
      const scopeFacts=activeFacts.filter(fact=>(fact.subjectId===scenario.assetId||fact.subjectId===scenario.id)&&fact.key===key);
      const matchingFacts=scopeFacts.filter(fact=>scenario.factIds.includes(fact.id));
      const matches=matchingFacts.filter(fact=>sourceFactMoneyValue(fact)===amount);
      if(scopeFacts.length!==1||matchingFacts.length!==1||matches.length!==1){reasons.push(`DISPOSAL_${field.toUpperCase()}_SOURCE_CONFLICT_OR_MISSING`);continue;}
      const invalidLineage=factSourceLineageIssues(data,[matches[0].id]).some(issue=>["SOURCE_FACTS_MISSING","STALE_OR_RETRACTED_FACT","DISPUTED_OR_REJECTED_FACT","SOURCE_REFERENCE_INVALID","SOURCE_VERIFICATION_RECEIPT_INVALID"].includes(issue));
      if(invalidLineage)reasons.push(`DISPOSAL_${field.toUpperCase()}_SOURCE_INVALID`);
    }
    if(reasons.length){
      const calculation={saleWon:null,payoffWon:null,costsWon:null,netProceedsWon:null,successorCashWon:null,shortfallWon:null,conserved:false,status:"needs_evidence" as const};
      return {scenarioId:scenario.id,assetId:scenario.assetId,tool:"calculate_disposal" as const,status:"blocked" as const,calculation,reasons:[...new Set(reasons)],factIds:scenario.factIds,recognition:scenario.recognition,courtApprovalInferred:false as const,disposalApprovalInferred:false as const};
    }
    const calculation=calculateDisposal({saleAmount:scenario.saleAmount!,securedPayoff:scenario.securedPayoff!,costs:scenario.costs!});
    return {scenarioId:scenario.id,assetId:scenario.assetId,tool:"calculate_disposal" as const,status:"provisional" as const,calculation,reasons:["DISPOSAL_SCENARIO_REQUIRES_HUMAN_REVIEW"],factIds:scenario.factIds,recognition:scenario.recognition,courtApprovalInferred:false as const,disposalApprovalInferred:false as const};
  }):[{scenarioId:null,assetId:null,tool:"calculate_disposal" as const,status:"blocked" as const,calculation:calculateDisposal({saleAmount:normalizeMoney(undefined),securedPayoff:normalizeMoney(undefined),costs:normalizeMoney(undefined)}),reasons:["DISPOSAL_INTENT_MISSING","DISPOSAL_SALE_AMOUNT_MISSING_OR_INVALID","DISPOSAL_SECURED_PAYOFF_MISSING_OR_INVALID","DISPOSAL_COSTS_MISSING_OR_INVALID"],factIds:[],recognition:"unreviewed" as const,courtApprovalInferred:false as const,disposalApprovalInferred:false as const}]) : undefined;
  return {version:EXECUTION_CONTRACT_VERSION,caseId:data.context.id,caseRevision:data.context.revision,ruleReleaseId:CURRENT_RULESET.id,
    computedBy:"deterministic-bigint" as const,assessment,workflow,plan,proposals,schedule,
    ...(disposalResults?{disposalResults}:{}),
    transactionReview:scanTransactions(data),
    ...(options.includeDocumentBindings?{formBindings:buildFormBindings(data,assessment.calculation),documentPayloads:buildCourtPackage(data,CURRENT_RULESET,assessment).documents}:{}),
    courtApprovalInferred:false as const,
  };
}

/** Compact, bounded node context; the complete plan stays in the read API. */
export function agentExecutionContext(result:ReturnType<typeof executeCaseNodes>) {
  return {version:result.version,caseRevision:result.caseRevision,ruleReleaseId:result.ruleReleaseId,
    documents:result.plan.documents.map(d=>({kind:d.kind,calculationIds:d.calculationIds})),
    calculations:result.plan.calculationTasks.map(c=>({id:c.id,executor:c.executor,inputs:c.inputs,outputs:c.outputs,decisionBoundary:c.decisionBoundary})),
    values:Object.fromEntries(Object.entries(result.assessment.calculation).filter(([,value])=>value===null||typeof value!=="object")),
    traceCoverage:{total:result.assessment.calculation.traces.length,provided:0,readTool:"calculate_case"},
    instruction:renderPromptPolicy("prompt.case_execution.agent_execution_context.instruction.instruction"),
    complete:false,courtApprovalInferred:false};
}
