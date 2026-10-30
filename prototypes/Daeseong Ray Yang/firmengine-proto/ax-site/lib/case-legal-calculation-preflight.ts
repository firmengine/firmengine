/** Before spending tokens on another 95-check AI cycle, reject exact
 * deterministic calculation/source integrity failures. Advisory legal review
 * is not held merely because a provisional OPTIONAL amount needs a lawyer:
 * only material source mismatch, incomplete representative income, or an
 * explicitly approved required calculator output is a preflight blocker.
 */
import {activeLegalEvidencePolicy} from "./legal-evidence-criteria.ts";
import type {CaseData} from "./domain.ts";
import type {LegalSourceReadiness} from "./case-legal-source-preflight.ts";
export const LEGAL_CALCULATION_PREFLIGHT_VERSION="legal-calculation-ai-preflight/1" as const;
export interface RequiredCalculationObservation{
 outputName:string;status:string;value:unknown;
}
export function evaluateLegalCalculationPreflight(input:{
 current:boolean;engineIssues:readonly string[];
 requiredOutputs:readonly string[];observed:readonly RequiredCalculationObservation[];
}):LegalSourceReadiness{
 if(!input.current)return {ready:false,retryable:true,status:"waiting_evidence",
   blockers:["CURRENT_CALCULATION_HEAD_MISSING"],nextAction:"원본 변경 후 현재 계산 작업이 완료되었는지 확인하세요."};
 const blockers=new Set<string>();
 const hardSource=/^CALC_INPUT_(?:UNCONNECTED_MATERIAL|MULTIPLE_TYPED_MATCHES|AMOUNT_INVALID|AMOUNT_MISMATCH|SOURCE_INVALID):/;
 for(const issue of input.engineIssues){
  if(hardSource.test(issue))blockers.add(issue.split(":")[0]);
  if(["INCOME_PERIOD_COVERAGE_INCOMPLETE","INCOME_REPRESENTATIVE_PERIOD_NOT_SELECTED",
      "INCOME_REPRESENTATIVE_PERIOD_REVIEW_REQUIRED"].includes(issue))blockers.add(issue);
 }
 for(const name of new Set(input.requiredOutputs)){
  const rows=input.observed.filter(row=>row.outputName===name);
  if(rows.length!==1||!["computed","reviewed_basis"].includes(rows[0].status)||
      rows[0].value===null||rows[0].value===undefined||
      rows[0].value===""||rows[0].value==="unknown"){
    blockers.add("REQUIRED_LEGAL_CALCULATOR_OUTPUT_UNRESOLVED:"+name);
  }
 }
 return blockers.size?{ready:false,retryable:false,status:"review_required",
   blockers:[...blockers].sort(),
   nextAction:"원문 금액·계산 객체·대표 소득기간·법률 승인된 필수 산식을 확인한 뒤 새 원본판본으로 재분석하세요."}:
  {ready:true,retryable:false,status:"ready",blockers:[],nextAction:""};
}
export async function inspectLegalAutomationCalculationReadiness(database:D1Database,data:CaseData)
 :Promise<LegalSourceReadiness>{
 const caseId=data.context.id;
 const head=await database.prepare(
   "SELECT c.revision AS caseRevision,s.data_version AS dataVersion,"+
   "h.run_id AS runId,r.missing_json AS missingJson "+
   "FROM cases c JOIN case_data_change_state s ON s.case_id=c.id "+
   "JOIN case_calculation_heads h ON h.case_id=c.id "+
   "JOIN case_calculation_runs r ON r.id=h.run_id "+
   "WHERE c.id=? AND h.data_version=s.data_version AND h.case_revision=c.revision"
 ).bind(caseId).first<{caseRevision:number;dataVersion:number;runId:string;missingJson:string}>();
 if(!head||head.caseRevision!==data.context.revision)
  return evaluateLegalCalculationPreflight({current:false,engineIssues:[],requiredOutputs:[],observed:[]});
 let json:unknown;
 try{json=JSON.parse(head.missingJson);}catch{return {ready:false,retryable:false,
   status:"review_required",blockers:["CALCULATION_STORED_ISSUES_INVALID"],nextAction:"저장된 계산 결과를 독립 검증하세요."};}
 const issues=(json&&typeof json==="object"&&!Array.isArray(json)&&
    "engineIssues" in json?(json as {engineIssues:unknown}).engineIssues:null);
 if(!Array.isArray(issues)||!issues.every(v=>typeof v==="string"))return {
  ready:false,retryable:false,status:"review_required",blockers:["CALCULATION_STORED_ISSUES_INVALID"],
  nextAction:"계산 실행 기록과 원천 출처를 다시 대조하세요."
 };
 const court=String(data.context.courtId??""),date=String(data.context.applicationDate??"");
 const required=[...new Set(activeLegalEvidencePolicy().checks
   .filter(c=>c.courtIds.includes(court)&&(!c.effectiveFrom||date>=c.effectiveFrom)&&(!c.effectiveTo||date<=c.effectiveTo))
   .flatMap(c=>c.requiredCalculationOutputs))].sort();
 const observed:RequiredCalculationObservation[]=[];
 for(let offset=0;offset<required.length;offset+=75){
  const names=required.slice(offset,offset+75);
  const rows=(await database.prepare(
    "SELECT output_name AS outputName,status,value_json AS valueJson "+
    "FROM case_calculation_features WHERE run_id=? AND output_name IN ("+
    names.map(()=>"?").join(",")+")"
   ).bind(head.runId,...names).all<{outputName:string;status:string;valueJson:string}>()).results??[];
  for(const row of rows){
    let value:unknown;
    try{value=JSON.parse(row.valueJson);}catch{value=undefined;}
    observed.push({outputName:row.outputName,status:row.status,value});
  }
 }
 return evaluateLegalCalculationPreflight({current:true,
   engineIssues:issues as string[],requiredOutputs:required,observed});
}
