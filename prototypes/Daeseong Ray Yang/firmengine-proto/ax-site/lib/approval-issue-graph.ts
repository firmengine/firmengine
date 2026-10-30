/** Approval-stage risk -> approved evidence -> existing calculation dependency graph.
 * No heuristic field alias, legal requirement invention, or automatic court decision.
 */
import type {Fact} from "./domain.ts";
import type {CalculationResult} from "./assessment.ts";

export const APPROVAL_ISSUE_GRAPH_VERSION="pre-approval-issue-graph/1" as const;
export interface ApprovalIssueRisk {
 id:string;title:string;current_rule_ids:readonly string[];
 required_features?:readonly string[];evidence_request?:string;
}
export interface ApprovalIssueEvidenceContract {
 checkId:string;status:string;
 requiredCanonicalFieldGroups:readonly (readonly string[])[];
 requiredCalculationOutputs:readonly string[];
 sourceUrls?:readonly string[];
}
export interface ApprovalIssueCalculationSpec {
 id:string;inputs:readonly string[];outputs:readonly string[];dependsOn:readonly string[];
}
export interface ApprovalIssueLegalCheck {
 id:string;status:string;reason:string;factIds:readonly string[];
 ruleIds:readonly string[];missingDocuments:readonly string[];nextAction:string;
}
export interface ApprovalIssueGraphInput {
 risks:readonly ApprovalIssueRisk[];
 contracts:readonly ApprovalIssueEvidenceContract[];
 facts:readonly Fact[];
 sourceValidAcceptedFactIds:ReadonlySet<string>;
 calculation:CalculationResult;
 calculations:readonly ApprovalIssueCalculationSpec[];
 legalCurrent:boolean;
 legalChecks:readonly ApprovalIssueLegalCheck[];
}
const uniq=(v:readonly string[])=>[...new Set(v)];
const missing=(v:unknown)=>v===null||v===undefined||v===""||v==="unknown";
const relatedCalculationIds=(output:string,specs:readonly ApprovalIssueCalculationSpec[])=>{
 const direct=specs.filter(spec=>spec.outputs.includes(output)).map(spec=>spec.id);
 const visited=new Set(direct);
 for(let change=true;change;){
  change=false;
  for(const spec of specs)if(!visited.has(spec.id)&&spec.dependsOn.some(id=>visited.has(id))){
   visited.add(spec.id);change=true;
  }
 }
 return [...visited];
};

/** Every defined risk is represented, including unmapped risks; previous legal verdicts are not re-decided. */
export function buildApprovalIssueGraph(input:ApprovalIssueGraphInput){
 const byContract=new Map(input.contracts.map(c=>[c.checkId,c]));
 const checks=new Map(input.legalCurrent?input.legalChecks.map(c=>[c.id,c]):[]);
 const byCanonical=new Map<string,Fact[]>();
 for(const fact of input.facts){
  const key=fact.canonicalFieldId??fact.fieldObservation?.canonicalFieldId;
  if(!key)continue;
  const rows=byCanonical.get(key)??[];
  rows.push(fact);byCanonical.set(key,rows);
 }
 const result=input.risks.map(risk=>{
  const contract=byContract.get(risk.id);
  const approved=contract?.status==="approved_evidence_route";
  const groups=approved?contract.requiredCanonicalFieldGroups:[];
  const fieldGroups=groups.map(group=>{
   const observed=uniq(group.flatMap(id=>(byCanonical.get(id)??[]).map(fact=>fact.id)));
   const accepted=observed.filter(id=>input.sourceValidAcceptedFactIds.has(id));
   return {canonicalAnyOf:[...group],observedFactIds:observed,validatedRecognizedFactIds:accepted,
    status:accepted.length?"supported_by_current_source" as const:observed.length?"observed_not_accepted" as const:"not_observed" as const};
  });
  const calculationOutputs=(approved?contract.requiredCalculationOutputs:[]).map(output=>{
   const row=input.calculation as unknown as Record<string,unknown>;
   const value=row[output];
   const status=!(output in row)?"undeclared_output":missing(value)?"missing":"value_present_requires_review";
   return {output,value:value??null,status,affectedCalculationIds:relatedCalculationIds(output,input.calculations)};
  });
  const check=checks.get(risk.id);
  const outstandingFacts=fieldGroups.filter(group=>group.status!=="supported_by_current_source");
  const outstandingCalcs=calculationOutputs.filter(output=>output.status!=="value_present_requires_review");
  const questions=[
   ...(approved?outstandingFacts.map(group=>({kind:"source_feature" as const,anyOf:group.canonicalAnyOf,
    question:group.status==="not_observed"
     ?"해당 대상·기간의 원문에서 대체 가능 피처 중 하나가 존재하는지 확인"
     :"원문은 관측되었으나 증거검증·법률상 인정 또는 충돌 해소가 필요한지 확인"})):[]),
   ...outstandingCalcs.map(output=>({kind:"calculation_input" as const,anyOf:[output.output],
    question:"기존 계산 결과의 입력과 산식·법령판본을 확인하고 재계산"})),
  ];
  return {
   riskId:risk.id,title:risk.title,ruleIds:uniq(risk.current_rule_ids??[]),
   evidenceRoute:approved?"approved_for_routing" as const:"unmapped_or_not_applicable" as const,
   legalCheck:check?{status:check.status,reason:check.reason,factIds:[...check.factIds],
    ruleIds:[...check.ruleIds],missingDocuments:[...check.missingDocuments],nextAction:check.nextAction}
    :{status:"not_currently_reviewed",reason:"최신 사건·계산 판본의 법률 검토 결과가 없습니다.",
     factIds:[] as string[],ruleIds:[] as string[],missingDocuments:[] as string[],nextAction:"현행 근거로 재검토"},
   evidenceGroups:fieldGroups,calculationOutputs,questions,
   evidenceRequestFromLegacyCatalog:risk.evidence_request??"",
   caveat:approved?"승인된 증거 경로는 법적 요건·법원 인가 결정과 별개":
    "해당 위험 항목의 필수 피처/계산 계약이 승인되지 않아 카탈로그 후보를 법률상 필수로 승격하지 않음",
   legalOpinion:null,courtApprovalInferred:false as const,
  };
 });
 return {
  schemaVersion:APPROVAL_ISSUE_GRAPH_VERSION,scope:"pre_approval_only",
  totalRisks:result.length,
  approvedEvidenceRoutes:result.filter(x=>x.evidenceRoute==="approved_for_routing").length,
  unmappedOrOutOfScope:result.filter(x=>x.evidenceRoute!=="approved_for_routing").length,
  missingOrUnacceptedFeatureGroups:result.reduce((sum,x)=>sum+x.evidenceGroups.filter(g=>g.status!=="supported_by_current_source").length,0),
  missingCalculationOutputs:result.reduce((sum,x)=>sum+x.calculationOutputs.filter(c=>c.status!=="value_present_requires_review").length,0),
  units:result,
  ruleApplicationUnchanged:true as const,sourceAcceptanceUnchanged:true as const,
  legalDecisionUnchanged:true as const,courtApprovalInferred:false as const,
 };
}
