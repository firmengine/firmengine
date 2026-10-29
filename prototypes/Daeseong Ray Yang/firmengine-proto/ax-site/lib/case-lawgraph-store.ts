/** Store model-assisted review conditions and draft field values, never court approval. */
import { RISK_CATALOG } from "./legal-rules.ts";

export const CASE_LAWGRAPH_STORE_VERSION="case-lawgraph-review/1";
export type LegalConditionStatus="pass"|"fail"|"missing"|"conflict"|"not_applicable"|"legal_review";
export interface StoredLegalCheck {id:string;status:LegalConditionStatus;reason:string;factIds:string[];ruleIds:string[];missingDocuments:string[];nextAction:string;}
export interface StoredDocumentField {
  formCode:string;artifactKind:string;token:string;subjectId?:string|null;rowOrdinal?:number|null;
  value?:unknown;valueJSON?:unknown;valueKind:"source"|"derived"|"prose"|"layout";
  sourceFactIds?:string[];calcFeatureRefs?:string[];citation?:unknown;
}
export interface PersistCaseLawgraphReviewInput {
  caseId:string;dataVersion:number;caseRevision:number;calculationRunId:string;inputSha256:string;
  model:string;checks:StoredLegalCheck[];summary:string;documentFields?:StoredDocumentField[];
  complete:boolean;expectedCheckIds?:readonly string[];
}
const json=(v:unknown)=>JSON.stringify(v);
const stable=(v:unknown):string=>v===null||typeof v!=="object"?JSON.stringify(v)??"null":Array.isArray(v)?`[${v.map(stable).join(",")}]`:`{${Object.keys(v).sort().filter(k=>(v as Record<string,unknown>)[k]!==undefined).map(k=>`${JSON.stringify(k)}:${stable((v as Record<string,unknown>)[k])}`).join(",")}}`;
const sha=async(v:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))].map(v=>v.toString(16).padStart(2,"0")).join("");
const fault=(code:string)=>Object.assign(new Error(code),{code});
const expectedIds=(ids?:readonly string[])=>{
  const expected=ids?[...ids]:RISK_CATALOG.map(c=>c.id);
  if(!expected.length||new Set(expected).size!==expected.length||expected.some(id=>typeof id!=="string"||!id))throw fault("INVALID_LEGAL_REVIEW_EXPECTED_CHECKS");
  return expected;
};
function checkCoverage(checks:StoredLegalCheck[],expected:readonly string[]){
  const known=new Set(expected),seen=new Set<string>();
  for(const c of checks){
    if(!c.id||seen.has(c.id)||!known.has(c.id))throw fault("LEGAL_REVIEW_CHECK_ID_MISMATCH");
    if(!["pass","fail","missing","conflict","not_applicable","legal_review"].includes(c.status)||typeof c.reason!=="string"||typeof c.nextAction!=="string"||![c.factIds,c.ruleIds,c.missingDocuments].every(xs=>Array.isArray(xs)&&xs.every(x=>typeof x==="string")))throw fault("INVALID_LEGAL_REVIEW_CHECK");
    seen.add(c.id);
  }
  return expected.filter(id=>!seen.has(id));
}

export const AUTOMATIC_DRAFT_REQUIRED_OUTPUTS=["monthlyIncomeWon","debtPrincipalWon","debtInterestWon","totalDebtWon","securedDebtWon","unsecuredDebtWon","recognizedLivingCostWon","disposableIncomeWon","ordinaryRepaymentBudgetWon","liquidationValueWon","monthlyPaymentWon","planTotalWon","presentValueWon"] as const;
export interface AutomatedDraftEligibilityInput {
  checks:StoredLegalCheck[];expectedCheckIds?:readonly string[];complete:boolean;
  calculationHeadCurrent:boolean;engineCanGenerateDraft:boolean;
  requiredCalculationFields:readonly {outputName:string;value:unknown;status?:string}[];
  requiredCalculationOutputNames?:readonly string[];explicitFailures?:readonly string[];allowHumanReviewPendingForDraft?:boolean;
}
/** Draft-only mechanical gate. Passing LawGraph does not change the human final gate. */
export function automatedDraftEligibility(input:AutomatedDraftEligibilityInput){
  const reasons:string[]=[],expected=expectedIds(input.expectedCheckIds),missing=checkCoverage(input.checks,expected);
  if(!input.complete||missing.length)reasons.push("LEGAL_REVIEW_INCOMPLETE");
  if(input.checks.some(c=>c.status==="fail"))reasons.push("LEGAL_CONDITION_FAILED");
  const allowed=input.allowHumanReviewPendingForDraft?["pass","not_applicable","legal_review"]:["pass","not_applicable"];
  if(input.checks.some(c=>!allowed.includes(c.status)))reasons.push("LEGAL_CONDITION_UNRESOLVED");
  if(!input.calculationHeadCurrent)reasons.push("CALCULATION_HEAD_STALE");
  if(!input.engineCanGenerateDraft)reasons.push("ENGINE_DRAFT_GATE_BLOCKED");
  const required=input.requiredCalculationOutputNames??AUTOMATIC_DRAFT_REQUIRED_OUTPUTS;
  if(!required.length)reasons.push("REQUIRED_CALCULATION_FIELDS_NOT_DECLARED");
  for(const name of required){
    const candidates=input.requiredCalculationFields.filter(f=>f.outputName===name);
    if(candidates.length!==1||candidates[0].value===null||candidates[0].value===undefined||candidates[0].value===""||candidates[0].value==="unknown")reasons.push("CALCULATION_VALUE_MISSING:"+name);
    else if(["blocked","missing","conflict"].includes(candidates[0].status??""))reasons.push("CALCULATION_VALUE_UNRESOLVED:"+name);
    else if(candidates[0].value==="not_met")reasons.push("CALCULATION_CONDITION_FAILED:"+name);
  }
  if(input.explicitFailures?.length)reasons.push("EXPLICIT_FAILURE_PRESENT");
  return {eligible:reasons.length===0,mode:"draft" as const,reasons:[...new Set(reasons)],missingCheckIds:missing,requiredCalculationOutputNames:[...required],courtApprovalInferred:false,canFinalize:false,humanFinalGate:"unchanged" as const};
}

type SqlValue=string|number|null;
function rows(db:D1Database,table:string,columns:string[],values:SqlValue[][]){
  const size=Math.max(1,Math.floor(90/columns.length)),out:D1PreparedStatement[]=[];
  for(let start=0;start<values.length;start+=size){const chunk=values.slice(start,start+size);out.push(db.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(",")}) VALUES ${chunk.map(()=>`(${columns.map(()=>"?").join(",")})`).join(",")}`).bind(...chunk.flat()));}
  return out;
}
export async function persistCaseLawgraphReview(db:D1Database,input:PersistCaseLawgraphReviewInput){
  if(!input.caseId||!Number.isSafeInteger(input.dataVersion)||input.dataVersion<0||!Number.isSafeInteger(input.caseRevision)||input.caseRevision<1||!input.calculationRunId||!/^[a-f0-9]{64}$/i.test(input.inputSha256)||!["gpt-6-luna","gpt-6.1-terra"].includes(input.model)||typeof input.summary!=="string"||typeof input.complete!=="boolean")throw fault("INVALID_CASE_LEGAL_REVIEW_INPUT");
  const expected=expectedIds(input.expectedCheckIds),missing=checkCoverage(input.checks,expected),fields=input.documentFields??[];
  if(input.complete&&missing.length)throw fault("LEGAL_REVIEW_COMPLETE_COVERAGE_REQUIRED");
  if(input.checks.length>500||fields.length>5000)throw fault("LEGAL_REVIEW_ROW_COUNT_LIMIT");
  const calculation=await db.prepare("SELECT case_id,data_version,case_revision,input_sha256 FROM case_calculation_runs WHERE id=?").bind(input.calculationRunId).first<{case_id:string;data_version:number;case_revision:number;input_sha256:string}>();
  if(!calculation||calculation.case_id!==input.caseId||calculation.data_version!==input.dataVersion||calculation.case_revision!==input.caseRevision||calculation.input_sha256!==input.inputSha256)throw fault("LEGAL_REVIEW_CALCULATION_BINDING_MISMATCH");
  for(const f of fields){
    if(!f.formCode||!f.artifactKind||!f.token||!["source","derived","prose","layout"].includes(f.valueKind)||f.rowOrdinal!==undefined&&f.rowOrdinal!==null&&(!Number.isSafeInteger(f.rowOrdinal)||f.rowOrdinal<0))throw fault("INVALID_CASE_DOCUMENT_FIELD");
    if(f.sourceFactIds&&(!Array.isArray(f.sourceFactIds)||!f.sourceFactIds.every(x=>typeof x==="string"))||f.calcFeatureRefs&&(!Array.isArray(f.calcFeatureRefs)||!f.calcFeatureRefs.every(x=>typeof x==="string")))throw fault("INVALID_CASE_DOCUMENT_FIELD_REFS");
  }
  const referenced=[...new Set(fields.flatMap(f=>f.calcFeatureRefs??[]))];
  if(referenced.length>5000)throw fault("LEGAL_REVIEW_REFERENCE_COUNT_LIMIT");
  for(let start=0;start<referenced.length;start+=90){
    const chunk=referenced.slice(start,start+90),found=(await db.prepare(`SELECT id,run_id FROM case_calculation_features WHERE id IN (${chunk.map(()=>"?").join(",")})`).bind(...chunk).all<{id:string;run_id:string}>()).results??[];
    if(found.length!==chunk.length||found.some(f=>f.run_id!==input.calculationRunId))throw fault("DOCUMENT_FIELD_CALCULATION_REFERENCE_MISMATCH");
  }
  const payload={checks:input.checks,summary:input.summary,documentFields:fields,complete:input.complete,expectedCheckIds:expected},payloadJson=json(payload);
  if(new TextEncoder().encode(payloadJson).length>1_900_000)throw fault("LEGAL_REVIEW_PAYLOAD_SIZE_LIMIT");
  const runId="legal-review-"+await sha(stable({caseId:input.caseId,dataVersion:input.dataVersion,caseRevision:input.caseRevision,calculationRunId:input.calculationRunId,inputSha256:input.inputSha256,model:input.model,payload})),at=new Date().toISOString();
  const status=!input.complete?"partial":input.checks.some(c=>c.status==="fail")?"failed_conditions":input.checks.every(c=>["pass","not_applicable"].includes(c.status))?"conditions_passed":"review_required";
  const statements:D1PreparedStatement[]=[
    db.prepare("INSERT OR IGNORE INTO case_legal_review_runs (id,case_id,data_version,case_revision,calculation_run_id,input_sha256,model,status,complete,expected_check_ids_json,summary,raw_result_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(runId,input.caseId,input.dataVersion,input.caseRevision,input.calculationRunId,input.inputSha256,input.model,status,input.complete?1:0,json(expected),input.summary,payloadJson,at),
    ...rows(db,"case_legal_conditions",["id","review_run_id","ordinal","condition_id","status","reason","source_fact_ids_json","rule_ids_json","missing_documents_json","next_action"],input.checks.map((c,i)=>[`${runId}:condition:${String(i).padStart(6,"0")}`,runId,i,c.id,c.status,c.reason,json(c.factIds),json(c.ruleIds),json(c.missingDocuments),c.nextAction])),
    ...rows(db,"case_document_field_values",["id","review_run_id","ordinal","form_code","artifact_kind","token","subject_id","row_ordinal","value_json","value_kind","source_fact_ids_json","calculation_feature_refs_json","citation_json"],fields.map((f,i)=>[`${runId}:field:${String(i).padStart(8,"0")}`,runId,i,f.formCode,f.artifactKind,f.token,f.subjectId??null,f.rowOrdinal??null,json(f.value!==undefined?f.value:f.valueJSON??null),f.valueKind,json(f.sourceFactIds??[]),json(f.calcFeatureRefs??[]),json(f.citation??null)])),
    db.prepare("INSERT INTO case_legal_review_heads (case_id,review_run_id,data_version,case_revision,calculation_run_id,input_sha256,updated_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM cases c JOIN case_data_change_state s ON s.case_id=c.id JOIN case_calculation_heads h ON h.case_id=c.id WHERE c.id=? AND c.revision=? AND s.data_version=? AND h.run_id=? AND h.data_version=? AND h.case_revision=? AND h.input_sha256=?) ON CONFLICT(case_id) DO UPDATE SET review_run_id=excluded.review_run_id,data_version=excluded.data_version,case_revision=excluded.case_revision,calculation_run_id=excluded.calculation_run_id,input_sha256=excluded.input_sha256,updated_at=excluded.updated_at WHERE excluded.data_version>=case_legal_review_heads.data_version AND excluded.case_revision>=case_legal_review_heads.case_revision").bind(input.caseId,runId,input.dataVersion,input.caseRevision,input.calculationRunId,input.inputSha256,at,input.caseId,input.caseRevision,input.dataVersion,input.calculationRunId,input.dataVersion,input.caseRevision,input.inputSha256),
  ];
  const result=await db.batch(statements);if(!result.at(-1)?.meta?.changes)throw fault("LEGAL_REVIEW_VERSION_MISMATCH");
  return {runId,reviewRunId:runId,status,complete:input.complete,checks:input.checks.length,expectedChecks:expected.length,documentFields:fields.length,headPromoted:true,courtApprovalInferred:false,mode:"draft" as const,canFinalize:false};
}

interface ReviewHead {review_run_id:string;data_version:number;case_revision:number;calculation_run_id:string;input_sha256:string;model:string;status:string;complete:number;expected_check_ids_json:string;summary:string;created_at:string;}
export async function listCaseLawgraphReview(db:D1Database,input:{caseId:string;expectedDataVersion?:number;limit?:number;offset?:number}){
  const limit=input.limit??100,offset=input.offset??0;
  if(!input.caseId||!Number.isSafeInteger(limit)||limit<1||limit>500||!Number.isSafeInteger(offset)||offset<0)throw fault("INVALID_CASE_LEGAL_REVIEW_QUERY");
  const stateSql="SELECT c.revision,s.data_version,h.run_id AS calculation_run_id,h.data_version AS calculation_data_version,h.case_revision AS calculation_case_revision FROM cases c LEFT JOIN case_data_change_state s ON s.case_id=c.id LEFT JOIN case_calculation_heads h ON h.case_id=c.id WHERE c.id=?";
  const state=await db.prepare(stateSql).bind(input.caseId).first<{revision:number;data_version:number|null;calculation_run_id:string|null;calculation_data_version:number|null;calculation_case_revision:number|null}>();
  if(!state)throw fault("LEGAL_REVIEW_CASE_NOT_FOUND");
  if(input.expectedDataVersion!==undefined&&state.data_version!==input.expectedDataVersion)throw fault("LEGAL_REVIEW_VERSION_MISMATCH");
  const head=await db.prepare("SELECT h.*,r.model,r.status,r.complete,r.expected_check_ids_json,r.summary,r.created_at FROM case_legal_review_heads h JOIN case_legal_review_runs r ON r.id=h.review_run_id WHERE h.case_id=?").bind(input.caseId).first<ReviewHead>();
  const checkRows=head?(await db.prepare("SELECT * FROM case_legal_conditions WHERE review_run_id=? ORDER BY ordinal").bind(head.review_run_id).all<{condition_id:string;status:LegalConditionStatus;reason:string;source_fact_ids_json:string;rule_ids_json:string;missing_documents_json:string;next_action:string}>()).results??[]:[];
  const total=head?await db.prepare("SELECT COUNT(*) AS n FROM case_document_field_values WHERE review_run_id=?").bind(head.review_run_id).first<{n:number}>():null;
  const fieldRows=head?(await db.prepare("SELECT * FROM case_document_field_values WHERE review_run_id=? ORDER BY ordinal LIMIT ? OFFSET ?").bind(head.review_run_id,limit,offset).all<{id:string;ordinal:number;form_code:string;artifact_kind:string;token:string;subject_id:string|null;row_ordinal:number|null;value_json:string;value_kind:string;source_fact_ids_json:string;calculation_feature_refs_json:string;citation_json:string}>()).results??[]:[];
  const after=await db.prepare(stateSql).bind(input.caseId).first<typeof state>();
  if(stable(after)!==stable(state))throw fault("LEGAL_REVIEW_VERSION_MISMATCH");
  const headStale=!!head&&(head.data_version!==state.data_version||head.case_revision!==state.revision||head.calculation_run_id!==state.calculation_run_id||head.data_version!==state.calculation_data_version||head.case_revision!==state.calculation_case_revision);
  return {schemaVersion:CASE_LAWGRAPH_STORE_VERSION,caseId:input.caseId,currentDataVersion:state.data_version,currentCaseRevision:state.revision,runId:head?.review_run_id??null,dataVersion:head?.data_version??null,caseRevision:head?.case_revision??null,calculationRunId:head?.calculation_run_id??null,inputSha256:head?.input_sha256??null,
    model:head?.model??null,status:head?.status??"missing",complete:head?.complete===1,headStale,summary:head?.summary??null,expectedCheckIds:head?JSON.parse(head.expected_check_ids_json):[],
    courtApprovalInferred:false,mode:"draft",canFinalize:false,humanFinalGate:"unchanged",
    checks:checkRows.map(c=>({id:c.condition_id,status:c.status,reason:c.reason,factIds:JSON.parse(c.source_fact_ids_json),ruleIds:JSON.parse(c.rule_ids_json),missingDocuments:JSON.parse(c.missing_documents_json),nextAction:c.next_action})),
    totalDocumentFields:total?.n??0,limit,offset,nextOffset:offset+fieldRows.length<(total?.n??0)?offset+fieldRows.length:null,
    documentFields:fieldRows.map(f=>({fieldValueId:f.id,fieldOrdinal:f.ordinal,formCode:f.form_code,artifactKind:f.artifact_kind,token:f.token,subjectId:f.subject_id,rowOrdinal:f.row_ordinal,value:JSON.parse(f.value_json),valueKind:f.value_kind,sourceFactIds:JSON.parse(f.source_fact_ids_json),calcFeatureRefs:JSON.parse(f.calculation_feature_refs_json),citation:JSON.parse(f.citation_json)}))};
}
