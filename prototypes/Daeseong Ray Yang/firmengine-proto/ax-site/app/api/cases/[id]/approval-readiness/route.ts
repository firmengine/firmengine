/** Read-only pre-approval gap diagnostic. Does not change the existing legal or draft pipeline. */
import {db,errorResponse,getCase,HttpError,requireSameOrigin} from "../../../../../lib/server-store.ts";
import {createCaseReadIndex,currentFacts,factSourceLineageIssues} from "../../../../../lib/domain.ts";
import {executeCaseNodes} from "../../../../../lib/case-execution.ts";
import {caseRequirementMonitor} from "../../../../../lib/case-requirement-monitor.ts";
import {AUTOMATIC_DRAFT_REQUIRED_OUTPUTS,listCaseLawgraphReview} from "../../../../../lib/case-lawgraph-store.ts";
import {LEGAL_CATALOG,RISK_CATALOG} from "../../../../../lib/legal-rules.ts";
import {legalEvidenceInventory} from "../../../../../lib/legal-evidence-criteria.ts";
import {getCalculationSpecs} from "../../../../../lib/execution-catalog.ts";
import {buildApprovalIssueGraph} from "../../../../../lib/approval-issue-graph.ts";
import {auditFivePreapprovalStages,type StoredCalcFeature} from "../../../../../lib/preapproval-stage-audit.ts";
import {inspectPreapprovalOcrStorage} from "../../../../../lib/preapproval-ocr-storage-audit.ts";
import {auditStoredCalculationReplay} from "../../../../../lib/preapproval-calculation-replay.ts";
import {auditPreapprovalLegalCatalog} from "../../../../../lib/preapproval-legal-coverage-audit.ts";
import {readCourtCorrectionItems} from "../../../../../lib/preapproval-correction-item-store.ts";
import legalExceptions from "../../../../../lib/legal-exceptions.json" with {type:"json"};
import {referenceIdentity} from "../../../../../lib/reference-runtime.ts";
import referenceRelease from "../../../../../lib/reference-release.json" with {type:"json"};
import {buildPreApprovalReadiness,verifyStoredApprovalCalculationOutputs} from "../../../../../lib/approval-readiness.ts";

export const runtime="edge";
type Head={
 caseRevision:number;sourceDataVersion:number|null;
 calculationRunId:string|null;calcCaseRevision:number|null;calcDataVersion:number|null;
 runCaseRevision:number|null;runDataVersion:number|null;
 runInputSha256:string|null;headInputSha256:string|null;calcReferenceSha256:string|null;
};
const headSql="SELECT c.revision AS caseRevision,s.data_version AS sourceDataVersion,"
 +"h.run_id AS calculationRunId,h.case_revision AS calcCaseRevision,h.data_version AS calcDataVersion,"
 +"r.case_revision AS runCaseRevision,r.data_version AS runDataVersion,"
 +"r.input_sha256 AS runInputSha256,h.input_sha256 AS headInputSha256,"
 +"r.reference_sha256 AS calcReferenceSha256 FROM cases c "
 +"LEFT JOIN case_data_change_state s ON s.case_id=c.id "
 +"LEFT JOIN case_calculation_heads h ON h.case_id=c.id "
 +"LEFT JOIN case_calculation_runs r ON r.id=h.run_id WHERE c.id=?";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);
  const {id}=await params,query=new URL(request.url).searchParams;
  const expectedRevision=query.get("expectedRevision");
  if(expectedRevision!==null&&(!/^[1-9][0-9]*$/.test(expectedRevision)||!Number.isSafeInteger(Number(expectedRevision))))
   throw new HttpError(400,"잘못된 사건 판본입니다.");
  const data=await getCase(id),database=db();
  if(expectedRevision!==null&&Number(expectedRevision)!==data.context.revision)
   throw new HttpError(409,"사건이 변경되었습니다. 현재 판본으로 다시 조회하세요.");
  const before=await database.prepare(headSql).bind(id).first<Head>();
  if(!before||before.caseRevision!==data.context.revision)
   throw new HttpError(409,"계산/원본 스냅샷이 바뀌었습니다.");
  const activeReference=referenceIdentity()?.sha256??referenceRelease.sha256;
  let calculationCurrent=!!before.calculationRunId
   &&before.sourceDataVersion!==null
   &&before.calcCaseRevision===data.context.revision
   &&before.runCaseRevision===data.context.revision
   &&before.calcDataVersion===before.sourceDataVersion
   &&before.runDataVersion===before.sourceDataVersion
   &&!!before.runInputSha256&&before.runInputSha256===before.headInputSha256
   &&before.calcReferenceSha256===activeReference;
  // Reuse the live substitution/consultation/court-aware monitor. The monitor's
  // consultation IDs and workflow requirement IDs are intentionally NOT conflated.
  const [requirements,legal]=await Promise.allSettled([
    caseRequirementMonitor(database,data),
    listCaseLawgraphReview(database,{caseId:id,limit:1})
  ]);
  const execution=executeCaseNodes(data),assessment=execution.assessment;
  // Extra read-only integrity check: current persisted calculator feature values
  // must reproduce the active deterministic engine on this exact case revision.
  const calculationOutputNames=[...AUTOMATIC_DRAFT_REQUIRED_OUTPUTS,"liquidationComparison"];
  let calculationReplayIssues:string[]=[];
  if(calculationCurrent&&before.calculationRunId){
    try{
      const marks=calculationOutputNames.map(()=>"?").join(",");
      const stored=(await database.prepare("SELECT output_name AS outputName,value_json AS valueJson,status FROM case_calculation_features WHERE run_id=? AND output_name IN ("+marks+")")
        .bind(before.calculationRunId,...calculationOutputNames).all<{outputName:string;valueJson:string;status:string}>()).results??[];
      const verification=verifyStoredApprovalCalculationOutputs(assessment.calculation,stored,calculationOutputNames);
      calculationCurrent=verification.current;
      calculationReplayIssues=verification.issues;
    }catch{
      calculationCurrent=false;
      calculationReplayIssues=["CALCULATION_FEATURE_STORE_UNAVAILABLE"];
    }
  }
  const physicalOcr=await inspectPreapprovalOcrStorage(database,data)
    .catch(error=>({schemaVersion:"preapproval-ocr-storage-audit/1",caseId:id,
      status:"unavailable_fail_closed",reason:error instanceof Error?error.message:"UNKNOWN_OCR_SOURCE_ERROR",
      legalAcceptanceInferred:false,sourceVerificationInferred:false}));
  if(!("registeredCanonicalCount" in physicalOcr)||physicalOcr.status!=="observed_page_coverage_only")
    calculationCurrent=false;
  const sourceIndex=createCaseReadIndex(data),facts=currentFacts(data,sourceIndex);
  // Source state alone does not establish a valid original document or legal recognition.
  const acceptedFactIds=new Set(facts.filter(fact=>fact.state==="verified"&&fact.recognition==="accepted"
    &&!factSourceLineageIssues(data,[fact.id],sourceIndex).length).map(fact=>fact.id));
  // Read all stored calculator features, not just 13 summary figures. The audit
  // covers the declared inputs/outputs of every calculator and never treats
  // absence of a stored row as a zero or a completed execution.
  let persistedFeatures:StoredCalcFeature[]|null=null,featureReadComplete=false;
  try{
    if(before.calculationRunId){
      const result=await database.prepare("SELECT id,calculation_id AS calculationId,output_name AS outputName,output_path AS outputPath,status,value_json AS valueJson,value_won AS valueWon,source_fact_ids_json AS sourceFactIdsJson,formula FROM case_calculation_features WHERE run_id=? ORDER BY id LIMIT 5001")
        .bind(before.calculationRunId).all<StoredCalcFeature>();
      persistedFeatures=result.results??[];
      featureReadComplete=persistedFeatures.length<=5000;
    }
  }catch{
    persistedFeatures=null;featureReadComplete=false;
  }
  if(!featureReadComplete)calculationCurrent=false;
  const storedCalculationReplay=persistedFeatures&&featureReadComplete
    ?auditStoredCalculationReplay({execution,rows:persistedFeatures,currentFactIds:new Set(facts.map(f=>f.id))})
    :null;
  if(storedCalculationReplay&&!storedCalculationReplay.valid)calculationCurrent=false;
  const legalCatalogCoverage=auditPreapprovalLegalCatalog({
    caseData:data,facts,sourceValidatedAcceptedFactIds:acceptedFactIds,
    rules:LEGAL_CATALOG,exceptions:legalExceptions.scenarios,
  });
  const correctionItems=await readCourtCorrectionItems(database,data)
    .catch(error=>({status:"unavailable_fail_closed" as const,
      reason:error instanceof Error?error.message:"CORRECTION_ITEM_LEDGER_UNAVAILABLE",
      items:[],count:0,courtApprovalInferred:false as const}));
  const actualCorrectionEvents=(data.workflowState?.procedureEvents??[])
    .filter(event=>event.state==="correction_requested");
  const after=await database.prepare(headSql).bind(id).first<Head>();
  if(!after||JSON.stringify(after)!==JSON.stringify(before))
   throw new HttpError(409,"검토 중 원본 또는 계산판본이 변경되었습니다. 재조회하세요.");
  const output=buildPreApprovalReadiness({
    data,facts,assessment,
    sourceHead:{caseRevision:data.context.revision,sourceDataVersion:before.sourceDataVersion,
      calculationRunId:before.calculationRunId,calculationCurrent,referenceSha256:activeReference},
    monitor:requirements.status==="fulfilled"?requirements.value:null,
    legalReview:legal.status==="fulfilled"?legal.value:null,
    expectedRiskIds:RISK_CATALOG.map(x=>x.id),
    riskTitles:Object.fromEntries(RISK_CATALOG.map(x=>[x.id,x.title]))
  });
  const failures=[
    ...(requirements.status==="rejected"?["DOCUMENT_MONITOR_UNAVAILABLE"]:[]),
    ...(legal.status==="rejected"?["CURRENT_LAWGRAPH_UNAVAILABLE"]:[]),
    ...calculationReplayIssues,
    ...(actualCorrectionEvents.length&&("status" in correctionItems)?["COURT_CORRECTION_ITEM_LEDGER_UNAVAILABLE"]:[]),
    ...(!storedCalculationReplay?.valid&&storedCalculationReplay?["CALCULATION_ALL_STORED_ROWS_REPLAY_MISMATCH"]:[]),
    ...(!featureReadComplete?["FULL_CALCULATION_FEATURE_READ_INCOMPLETE"]:[]),
    ...(physicalOcr.status==="unavailable_fail_closed"?["CURRENT_OCR_COVERAGE_STORAGE_UNAVAILABLE"]:
      physicalOcr.status==="source_integrity_or_page_gap"?["CURRENT_OCR_PAGE_OR_SOURCE_INTEGRITY_GAP"]:
      physicalOcr.status==="no_active_documents"?["NO_ACTIVE_OCR_SOURCE_DOCUMENTS"]:[])
  ];
  const graph=buildApprovalIssueGraph({
    risks:RISK_CATALOG,
    contracts:legalEvidenceInventory(data.context.courtId,data.context.applicationDate),
    facts,sourceValidAcceptedFactIds:acceptedFactIds,
    calculation:assessment.calculation,calculations:getCalculationSpecs(),
    legalCurrent:output.legalReview.current,legalChecks:output.legalReview.findings,
  });
  const stageAudit=auditFivePreapprovalStages({
    data,facts,assessment,
    calculationSpecs:getCalculationSpecs(),
    selectedCalculationIds:execution.plan.calculationTasks.map(task=>task.id),
    persistedCalculationFeatures:persistedFeatures,
    persistedCalculationComplete:featureReadComplete,calculationHeadCurrent:calculationCurrent,
    risks:RISK_CATALOG,exceptions:legalExceptions.scenarios,
    legalChecks:output.legalReview.findings,
    legalCurrent:output.legalReview.current,
    documents:requirements.status==="fulfilled"?requirements.value:null,
    validSourceFactIds:acceptedFactIds,
  });
  return Response.json({...output,judgmentGraph:graph,stageAudit,storedOcrCoverage:physicalOcr,storedCalculationReplay,legalCatalogCoverage,correctionItems,dependencyFailures:failures},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
