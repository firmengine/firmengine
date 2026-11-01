/** Persist existing deterministic engine outputs, never perform arithmetic or infer approval. */
import type { CaseExecution } from "./case-agent.ts";
import type { CalculationTrace } from "./assessment.ts";
import { getCalculationSpecs, EXECUTION_CONTRACT_VERSION } from "./execution-catalog.ts";
import { referenceIdentity } from "./reference-runtime.ts";
import referenceRelease from "./reference-release.json" with { type: "json" };

export const CASE_CALCULATION_FEATURE_STORE_VERSION="case-calculation-features/1";
export type CalculationFeatureStatus="computed"|"provisional"|"blocked"|"missing"|"conflict"|"not_applicable";
export interface PersistCaseCalculationFeaturesInput {
  caseId:string;dataVersion:number;caseRevision:number;inputSha256:string;execution:CaseExecution;
  sourceHeads?:unknown;referenceRelease?:{id:string;revision:number;sha256:string};
}
interface Feature {
  calculationId:string;outputName:string;outputPath:string;subjectId:string|null;rowOrdinal:number|null;
  value:unknown;valueWon:string|null;status:CalculationFeatureStatus;sourceFactIds:string[];inputRefs:unknown;formula:string;reasons:string[];
}
const json=(v:unknown)=>JSON.stringify(v);
const sha=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,"0")).join("");
const stable=(v:unknown):string=>v===null||typeof v!=="object"?JSON.stringify(v)??"null":Array.isArray(v)?`[${v.map(stable).join(",")}]`:`{${Object.keys(v).sort().filter(k=>(v as Record<string,unknown>)[k]!==undefined).map(k=>`${JSON.stringify(k)}:${stable((v as Record<string,unknown>)[k])}`).join(",")}}`;
const error=(code:string)=>Object.assign(new Error(code),{code});
const conflict=(reasons:string[])=>reasons.some(r=>/CONFLICT|DISPUTED|AMBIGUOUS/.test(r));
function statusOf(value:unknown,engineStatus:string|undefined,reasons:string[]=[]):CalculationFeatureStatus{
  if(engineStatus==="not_applicable")return "not_applicable";
  if(conflict(reasons))return "conflict";
  if(value===null||value===undefined||value==="unknown")return engineStatus==="blocked"?"blocked":"missing";
  if(engineStatus==="calculated"||engineStatus==="computed"||engineStatus==="reviewed_basis")return "computed";
  // A known component can remain provisional even when its aggregate trace is
  // blocked by a different missing component. No output is replaced by zero.
  return "provisional";
}
function factIds(value:unknown):string[]{
  const ids=new Set<string>();
  const visit=(v:unknown)=>{
    if(Array.isArray(v)){for(const x of v)visit(x);return;}
    if(v&&typeof v==="object")for(const [k,x]of Object.entries(v)){
      if(/(?:factIds|FactIds)$/.test(k)&&Array.isArray(x)){for(const id of x)if(typeof id==="string")ids.add(id);}
      else visit(x);
    }
  };
  visit(value);return [...ids];
}
const won=(name:string,value:unknown):string|null=>/Won$/.test(name)&&((typeof value==="string"&&/^-?\d+$/.test(value))||(typeof value==="number"&&Number.isSafeInteger(value)))?String(value):null;

/** Exported pure serialization for verification; all numeric results already exist in execution. */
export function calculationFeatureRows(execution:CaseExecution):Feature[]{
  const calculation=execution.assessment.calculation,specs=getCalculationSpecs(),features:Feature[]=[];
  const owner=(name:string)=>specs.find(s=>s.outputs.includes(name));
  const traceFor=(name:string):CalculationTrace[]=>{
    const id=({disposableIncomeWon:"disposable",ordinaryRepaymentBudgetWon:"ordinary_budget",liquidationComparison:"liquidation_comparison",presentValueWon:"liquidation_comparison"} as Record<string,string>)[name];
    if(id)return calculation.traces.filter(t=>t.id===id);
    if(["monthlyIncomeWon","incomeGroups"].includes(name))return calculation.traces.filter(t=>t.id.startsWith("income_group:"));
    if(["debtPrincipalWon","debtInterestWon","totalDebtWon","securedDebtWon","unsecuredDebtWon"].includes(name))return calculation.traces.filter(t=>t.id.startsWith("debt:"));
    if(name==="liquidationValueWon")return calculation.traces.filter(t=>t.id.startsWith("asset:"));
    return [];
  };
  const add=(name:string,path:string,value:unknown,options:{calculationId?:string;subjectId?:string|null;rowOrdinal?:number|null;trace?:CalculationTrace;engineStatus?:string;reasons?:string[];ids?:string[];formula?:string}={})=>{
    const spec=owner(name.split(".")[0]),traces=options.trace?[options.trace]:traceFor(name),reasons=options.reasons??traces.flatMap(t=>t.reasons);
    const engineStatus=options.engineStatus??(traces.length&&traces.every(t=>t.status==="calculated")?"calculated":traces.some(t=>t.status==="blocked")?"blocked":"provisional");
    features.push({calculationId:options.calculationId??spec?.id??"engine_output",outputName:name,outputPath:path,subjectId:options.subjectId??null,rowOrdinal:options.rowOrdinal??null,
      value:value===undefined?null:value,valueWon:won(name.split(".").at(-1)!,value),status:statusOf(value,engineStatus,reasons),sourceFactIds:options.ids??factIds(traces),
      inputRefs:{declaredInputPaths:spec?.inputs??[],traceInputs:traces.flatMap(t=>t.inputs)},formula:options.formula??options.trace?.formula??spec?.formula??"Existing engine output; no arithmetic performed by storage",reasons});
  };
  for(const [name,value]of Object.entries(calculation))if(value===null||["string","number","boolean"].includes(typeof value)){
    if(["caseRevision","computedBy"].includes(name))continue;
    add(name,`/assessment/calculation/${name}`,value);
  }
  for(const group of ["incomeRows","incomeGroups","debtRows","assetRows","allocations"] as const){
    for(const [index,row]of calculation[group].entries()){
      const r=row as unknown as Record<string,unknown>,subjectId=typeof r.id==="string"?r.id:typeof r.debtId==="string"?r.debtId:null;
      const prefix={incomeRows:"income:",incomeGroups:"income_group:",debtRows:"debt:",assetRows:"asset:",allocations:"allocation:"}[group];
      const trace=calculation.traces.find(t=>t.id===prefix+subjectId),reasons=Array.isArray(r.reasons)?r.reasons.filter((x):x is string=>typeof x==="string"):trace?.reasons??[];
      for(const [name,value]of Object.entries(r)){
        if(["id","debtId","factIds","sourceIds","reasons"].includes(name))continue;
        if(value!==null&&typeof value==="object")continue;
        add(`${group}.${name}`,`/assessment/calculation/${group}/${index}/${name}`,value,{subjectId,rowOrdinal:index,trace,reasons,ids:[...new Set([...factIds(row),...factIds(trace??[])])],engineStatus:group==="allocations"?String(r.status):trace?.status,calculationId:owner(group)?.id});
      }
    }
  }
  // Exact trace result + explicit inputs/formula provide the most direct SQL
  // lineage when a provisional component exists but case aggregates are missing.
  const traceCalculationIds:Record<string,string>={income:"income_average",income_group:"income_aggregation",debt:"debt_total",asset:"asset_liquidation",disposable:"available_income"};
  for(const [index,t]of calculation.traces.entries())add("traces.resultWon",`/assessment/calculation/traces/${index}/resultWon`,t.resultWon,{calculationId:traceCalculationIds[t.id.split(":")[0]]??t.id.split(":")[0],subjectId:t.id.includes(":")?t.id.slice(t.id.indexOf(":")+1):null,rowOrdinal:index,trace:t,reasons:t.reasons});
  const walk=(v:unknown,path:string,name:string,status:string|undefined,reasons:string[],ids:string[],calculationId:string,rowOrdinal:number|null=null,subjectId:string|null=null)=>{
    if(v===null||typeof v!=="object"){add(name,path,v,{engineStatus:status,reasons,ids,calculationId,rowOrdinal,subjectId});return;}
    if(Array.isArray(v)){for(const [index,x]of v.entries())walk(x,`${path}/${index}`,name,status,reasons,ids,calculationId,index,subjectId);return;}
    const r=v as Record<string,unknown>,nestedStatus=typeof r.status==="string"?r.status:status,nestedReasons=[...reasons,...(typeof r.reason==="string"?[r.reason]:[])],nestedIds=[...new Set([...ids,...factIds(v)])],identity=typeof r.id==="string"?r.id:typeof r.debtId==="string"?r.debtId:subjectId;
    for(const [key,x]of Object.entries(r))if(!["sources","sourceUrl","sourceText","factIds","sourceFactIds","additionalExpenseFactIds","sourceFactIds"].includes(key))walk(x,`${path}/${key}`,`${name}.${key}`,nestedStatus,nestedReasons,nestedIds,calculationId,rowOrdinal,identity);
  };
  for(const [name,id]of Object.entries({livingCost:"living_cost_proposal",objectionMinimum:"objection_minimum",termCandidate:"seoul_short_term"})){
    const value=(execution.proposals as unknown as Record<string,unknown>)[name];
    if(value===undefined)add(`proposals.${name}`,`/proposals/${name}`,null,{calculationId:id,reasons:["ENGINE_OUTPUT_NOT_PRODUCED"]});
    else walk(value,`/proposals/${name}`,`proposals.${name}`,undefined,[],[],id);
  }
  // Scope metadata is deliberately false; it is not a prediction that the case
  // will be rejected. Store it separately from eligibility/proposal outcomes.
  add("courtApprovalInferred","/courtApprovalInferred",execution.courtApprovalInferred,{calculationId:"scope",engineStatus:"not_applicable",formula:"Engine explicitly does not infer court approval"});
  return features;
}

type SqlValue=string|number|null;
function inserts(db:D1Database,table:string,columns:string[],rows:SqlValue[][]):D1PreparedStatement[]{
  const chunkSize=Math.max(1,Math.floor(90/columns.length)),statements:D1PreparedStatement[]=[];
  for(let start=0;start<rows.length;start+=chunkSize){const chunk=rows.slice(start,start+chunkSize);statements.push(db.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(",")}) VALUES ${chunk.map(()=>`(${columns.map(()=>"?").join(",")})`).join(",")}`).bind(...chunk.flat()));}
  return statements;
}
export async function persistCaseCalculationFeatures(db:D1Database,input:PersistCaseCalculationFeaturesInput){
  if(!input.caseId||!Number.isSafeInteger(input.dataVersion)||input.dataVersion<0||!Number.isSafeInteger(input.caseRevision)||input.caseRevision<1||!/^[a-f0-9]{64}$/i.test(input.inputSha256))throw error("INVALID_CALCULATION_FEATURE_INPUT");
  const e=input.execution;
  if(e.caseId!==input.caseId||e.caseRevision!==input.caseRevision||e.assessment.calculation.caseRevision!==input.caseRevision||e.computedBy!=="deterministic-bigint"||e.courtApprovalInferred!==false)throw error("CALCULATION_EXECUTION_BINDING_MISMATCH");
  const exists=await db.prepare("SELECT revision FROM cases WHERE id=?").bind(input.caseId).first<{revision:number}>();
  if(!exists)throw error("CALCULATION_CASE_NOT_FOUND");
  const reference=input.referenceRelease??referenceIdentity()??{id:referenceRelease.id,revision:referenceRelease.revision,sha256:referenceRelease.sha256};
  const contractVersion=e.version??EXECUTION_CONTRACT_VERSION,sourceHeadsJson=json(input.sourceHeads??null),sourceHeadsSha=await sha(sourceHeadsJson);
  const rawResultJson=json({calculation:e.assessment.calculation,proposals:e.proposals,courtApprovalInferred:e.courtApprovalInferred});
  if(new TextEncoder().encode(rawResultJson).length>1_900_000||new TextEncoder().encode(sourceHeadsJson).length>1_000_000)throw error("CALCULATION_FEATURE_RESULT_SIZE_LIMIT");
  const rows=calculationFeatureRows(e);
  if(rows.length>5000)throw error("CALCULATION_FEATURE_COUNT_LIMIT");
  const missing=rows.filter(f=>["missing","blocked","conflict"].includes(f.status)).map(f=>({calculationId:f.calculationId,outputName:f.outputName,outputPath:f.outputPath,subjectId:f.subjectId,status:f.status,reasons:f.reasons}));
  const knownMoney=rows.filter(f=>f.valueWon!==null&&["computed","provisional"].includes(f.status)).length;
  const status:CalculationFeatureStatus=!knownMoney&&missing.length?"missing":rows.some(f=>f.status==="provisional")||missing.length?"provisional":"computed";
  const at=new Date().toISOString(),runId="calculation-"+await sha(stable({caseId:input.caseId,dataVersion:input.dataVersion,caseRevision:input.caseRevision,inputSha256:input.inputSha256,ruleReleaseId:e.ruleReleaseId,reference,contractVersion,sourceHeadsSha,rawResultSha:await sha(rawResultJson)}));
  const statements:D1PreparedStatement[]=[db.prepare("INSERT OR IGNORE INTO case_calculation_runs (id,case_id,data_version,case_revision,input_sha256,rule_release_id,reference_id,reference_revision,reference_sha256,contract_version,status,missing_json,raw_result_json,source_heads_json,source_heads_sha256,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(runId,input.caseId,input.dataVersion,input.caseRevision,input.inputSha256,e.ruleReleaseId,reference.id,reference.revision,reference.sha256,contractVersion,status,json({features:missing,engineIssues:e.assessment.calculation.issues}),rawResultJson,sourceHeadsJson,sourceHeadsSha,at),
    ...inserts(db,"case_calculation_features",["id","run_id","calculation_id","output_name","output_path","subject_id","row_ordinal","value_json","value_won","status","source_fact_ids_json","input_refs_json","formula"],rows.map((f,index)=>[`${runId}:feature:${String(index).padStart(8,"0")}`,runId,f.calculationId,f.outputName,f.outputPath,f.subjectId,f.rowOrdinal,json(f.value),f.valueWon,f.status,json(f.sourceFactIds),json({...f.inputRefs as object,sourceHeadsSha256:sourceHeadsSha,reasons:f.reasons}),f.formula])),
    db.prepare("INSERT INTO case_calculation_heads (case_id,run_id,data_version,case_revision,input_sha256,updated_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM cases c JOIN case_data_change_state s ON s.case_id=c.id WHERE c.id=? AND c.revision=? AND s.data_version=?) ON CONFLICT(case_id) DO UPDATE SET run_id=excluded.run_id,data_version=excluded.data_version,case_revision=excluded.case_revision,input_sha256=excluded.input_sha256,updated_at=excluded.updated_at WHERE excluded.data_version>=case_calculation_heads.data_version AND excluded.case_revision>=case_calculation_heads.case_revision").bind(input.caseId,runId,input.dataVersion,input.caseRevision,input.inputSha256,at,input.caseId,input.caseRevision,input.dataVersion)];
  const result=await db.batch(statements);
  if(!result.at(-1)?.meta?.changes)throw error("CALCULATION_VERSION_MISMATCH");
  return {runId,dataVersion:input.dataVersion,caseRevision:input.caseRevision,inputSha256:input.inputSha256,features:rows.length,headPromoted:true,status,missingCount:missing.length,courtApprovalInferred:false};
}

interface Head {run_id:string;data_version:number;case_revision:number;input_sha256:string;status:string;rule_release_id:string;reference_id:string;reference_revision:number;reference_sha256:string;contract_version:string;source_heads_json:string;source_heads_sha256:string;missing_json:string;created_at:string;}
interface StoredFeature {id:string;calculation_id:string;output_name:string;output_path:string;subject_id:string|null;row_ordinal:number|null;value_json:string;value_won:string|null;status:CalculationFeatureStatus;source_fact_ids_json:string;input_refs_json:string;formula:string;}
export async function listCaseCalculationFeatures(db:D1Database,input:{caseId:string;expectedDataVersion?:number;limit?:number;offset?:number}){
  const limit=input.limit??100,offset=input.offset??0;
  if(!input.caseId||!Number.isSafeInteger(limit)||limit<1||limit>500||!Number.isSafeInteger(offset)||offset<0)throw error("INVALID_CALCULATION_FEATURE_QUERY");
  const current=await db.prepare("SELECT c.revision,s.data_version FROM cases c LEFT JOIN case_data_change_state s ON s.case_id=c.id WHERE c.id=?").bind(input.caseId).first<{revision:number;data_version:number|null}>();
  if(!current)throw error("CALCULATION_CASE_NOT_FOUND");
  if(input.expectedDataVersion!==undefined&&input.expectedDataVersion!==current.data_version)throw error("CALCULATION_VERSION_MISMATCH");
  const head=await db.prepare("SELECT h.*,r.status,r.rule_release_id,r.reference_id,r.reference_revision,r.reference_sha256,r.contract_version,r.source_heads_json,r.source_heads_sha256,r.missing_json,r.created_at FROM case_calculation_heads h JOIN case_calculation_runs r ON r.id=h.run_id WHERE h.case_id=?").bind(input.caseId).first<Head>();
  const total=head?await db.prepare("SELECT COUNT(*) AS n FROM case_calculation_features WHERE run_id=?").bind(head.run_id).first<{n:number}>():null;
  const features=head?(await db.prepare("SELECT * FROM case_calculation_features WHERE run_id=? ORDER BY id LIMIT ? OFFSET ?").bind(head.run_id,limit,offset).all<StoredFeature>()).results??[]:[];
  const after=await db.prepare("SELECT c.revision,s.data_version FROM cases c LEFT JOIN case_data_change_state s ON s.case_id=c.id WHERE c.id=?").bind(input.caseId).first<{revision:number;data_version:number|null}>();
  if(after?.revision!==current.revision||after?.data_version!==current.data_version)throw error("CALCULATION_VERSION_MISMATCH");
  return {schemaVersion:CASE_CALCULATION_FEATURE_STORE_VERSION,caseId:input.caseId,currentDataVersion:current.data_version,currentCaseRevision:current.revision,
    runId:head?.run_id??null,dataVersion:head?.data_version??null,caseRevision:head?.case_revision??null,inputSha256:head?.input_sha256??null,
    headStale:!!head&&(head.data_version!==current.data_version||head.case_revision!==current.revision),status:head?.status??"missing",courtApprovalInferred:false,
    ruleReleaseId:head?.rule_release_id??null,referenceRelease:head?{id:head.reference_id,revision:head.reference_revision,sha256:head.reference_sha256}:null,contractVersion:head?.contract_version??null,
    sourceHeads:head?JSON.parse(head.source_heads_json):null,sourceHeadsSha256:head?.source_heads_sha256??null,missing:head?JSON.parse(head.missing_json):null,
    totalFeatures:total?.n??0,limit,offset,nextOffset:offset+features.length<(total?.n??0)?offset+features.length:null,
    features:features.map(f=>({featureId:f.id,runId:head!.run_id,dataVersion:head!.data_version,caseRevision:head!.case_revision,calculationId:f.calculation_id,outputName:f.output_name,outputPath:f.output_path,subjectId:f.subject_id,rowOrdinal:f.row_ordinal,value:JSON.parse(f.value_json),valueWon:f.value_won,status:f.status,sourceFactIds:JSON.parse(f.source_fact_ids_json),inputRefs:JSON.parse(f.input_refs_json),formula:f.formula}))};
}
