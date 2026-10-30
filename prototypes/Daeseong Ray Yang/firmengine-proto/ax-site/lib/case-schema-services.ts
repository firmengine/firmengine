import { db,getCase } from "./server-store.ts";
import { listCaseDocumentRequirements } from "./case-document-requirement-store.ts";
import { listCaseExtractionRows, listCaseExtractionCoverage } from "./extraction-row-store.ts";
import { listCaseDataUpdates } from "./case-data-watch.ts";
import { listCaseCalculationFeatures } from "./case-calculation-feature-store.ts";
import { listCaseLawgraphReview } from "./case-lawgraph-store.ts";
import { processCaseAgentUpdates } from "./case-agent-scheduler.ts";
import { caseRequirementMonitor, listCaseDocumentWorkEvents } from "./case-requirement-monitor.ts";
import { buildOcrChainMatrix } from "./ocr-chain-matrix.ts";
import { getIntakeCatalog } from "./intake-store.ts";
import { readCaseLegalAutomation } from "./case-legal-automation.ts";
import { buildFeatureLineageAudit,evaluateCaseFieldLineage,auditLegalRiskContracts,auditCourtPracticeGaps } from "./feature-lineage-audit.ts";
import { buildCalculationInputAudit } from "./calculation-input-audit.ts";
import {auditBusinessSourceEvidence} from "./business-source-evidence.ts";
import {buildBusinessMonthlyWorkbench} from "./business-monthly-workbench.ts";
import {businessIdentityCrosswalk} from "./business-identity-crosswalk.ts";
import {businessSchemaIntegrityAudit} from "./business-schema-integrity.ts";

export const CASE_SCHEMA_CONTRACT={
  version:"case-feature-storage/1",databaseBinding:"DB",databaseEngine:"Cloudflare D1 / SQLite",
  identity:{caseId:"cases.id (internal UUID; court case number is separate)",documentTypeId:"shared_document_types.id",documentId:"documents.id (uploaded source file)",documentInstanceId:"document_instances.id (page-bound until logical boundary is reviewed)"},
  tables:{catalog:"shared_document_types",catalogHistory:"shared_document_type_versions",requests:"case_document_requirements",requiredFieldPlans:"case_requirement_field_plans",documentWorkEvents:"case_document_work_events",substitutionWatchHeads:"case_substitution_watch_heads",substitutionRequestStates:"case_substitution_request_states",substitutionHistory:"case_substitution_transition_events",sourceInstances:"document_instances",sourceRuns:"extraction_runs",schemaVersions:"extraction_schema_versions",schemaFields:"extraction_schema_fields",records:"extraction_records",sourceFeatures:"extracted_features",sourceCoverage:"extraction_field_coverage",sourceHeads:"case_extraction_heads",changeEvents:"case_data_change_events",changeVersions:"case_data_change_state",calculationRuns:"case_calculation_runs",calculationFeatures:"case_calculation_features",calculationHeads:"case_calculation_heads",legalRuns:"case_legal_review_runs",legalConditions:"case_legal_conditions",documentFields:"case_document_field_values",legalHeads:"case_legal_review_heads",automaticDocuments:"case_automatic_document_runs",legalAutomationJobs:"case_legal_automation_jobs",legalAutomationEvents:"case_legal_automation_events"},
  repeatability:"Each transaction / event / month / creditor-item is a separate extraction_records row. Its source cells are separate extracted_features rows. Preserve row order and source identities.",
  absence:"null, zero, blank, masked, illegible, explicit_none, not_seen, conflicting and unbound are distinct; no default-zero imputation.",
  scheduling:{sourceQuietMs:600000,order:["legal_calculation","lawgraph_review","automatic_draft"],derivedWritesResetQuietPeriod:false,manualGenerationRetained:true},
  calculator:{tool:"calculate_case",arguments:["caseId","expectedRevision"],snapshot:"Server resolves the current stored typed case view, validates normalized source heads, and never accepts an agent-invented replacement caseData."},
  limitations:["Normalized source features do not grant source verification or legal recognition.","Automated documents are review drafts; finalization and filing remain separate."]
} as const;

export function caseSchemaServices(){
  return {
    caseRequirements:async(input:{caseId:string;expectedRevision?:number})=>{
      const data=await getCase(input.caseId);
      if(input.expectedRevision!==undefined&&input.expectedRevision!==data.context.revision)throw Object.assign(new Error("CASE_REVISION_MISMATCH"),{code:"CASE_REVISION_MISMATCH"});
      return {caseRevision:data.context.revision,...await listCaseDocumentRequirements(db(),input.caseId)};
    },
    caseExtractions:(input:{caseId:string;documentTypeId?:string;expectedRevision?:number;limit?:number;offset?:number})=>listCaseExtractionRows(db(),input),
    caseCoverage:(input:{caseId:string;documentTypeId?:string;expectedRevision?:number;limit?:number;offset?:number})=>listCaseExtractionCoverage(db(),input),
    caseUpdates:(input:{caseId?:string;afterEventId?:number;limit?:number})=>listCaseDataUpdates(db(),input),
    caseCalculations:(input:{caseId:string;expectedDataVersion?:number;limit?:number;offset?:number})=>listCaseCalculationFeatures(db(),input),
    processCaseUpdates:(input:{caseId?:string;limit?:number})=>processCaseAgentUpdates(input),
  };
}
export async function readCaseSchemaData(caseId:string,input:{view?:string;documentTypeId?:string;expectedRevision?:number;limit?:number;offset?:number;afterEventId?:number}={}){
  const data=await getCase(caseId);
  if(input.expectedRevision!==undefined&&input.expectedRevision!==data.context.revision)throw Object.assign(new Error("CASE_REVISION_MISMATCH"),{code:"CASE_REVISION_MISMATCH"});
  const services=caseSchemaServices(),view=input.view??"requirements";
  if(view==="schema")return CASE_SCHEMA_CONTRACT;
  if(view==="requirements")return services.caseRequirements({caseId,expectedRevision:input.expectedRevision});
   if(view==="requirement_monitor")return caseRequirementMonitor(db(),data);
   if(view==="requirement_events")return listCaseDocumentWorkEvents(db(),{caseId,afterEventId:input.afterEventId,limit:input.limit});
  if(view==="extractions")return services.caseExtractions({caseId,...input});
  if(view==="coverage")return services.caseCoverage({caseId,...input});
  if(view==="field_matrix"){
    const active=await getIntakeCatalog();
    return buildOcrChainMatrix(active.catalog,active.sha256,{documentTypeId:input.documentTypeId,limit:input.limit,offset:input.offset});
  }
  if(view==="feature_audit"||view==="case_feature_audit"){
    const active=await getIntakeCatalog();
    if(view==="feature_audit")return buildFeatureLineageAudit(active.catalog,active.sha256,{limit:input.limit,offset:input.offset});
    const all=buildFeatureLineageAudit(active.catalog,active.sha256,{limit:1000});
    return evaluateCaseFieldLineage(data,all.fields,{limit:input.limit,offset:input.offset});
  }
  if(view==="business_schema_integrity")return businessSchemaIntegrityAudit();
  if(view==="business_identity_crosswalk")return businessIdentityCrosswalk(data);
  if(view==="business_monthly_workbench")return buildBusinessMonthlyWorkbench(data);
  if(view==="business_source_audit")
    return auditBusinessSourceEvidence(data,undefined,{limit:input.limit,offset:input.offset});
  if(view==="calculation_input_audit"){
    const active=await getIntakeCatalog();
    const all=buildFeatureLineageAudit(active.catalog,active.sha256,{limit:1000});
    return buildCalculationInputAudit(all.fields);
  }
  if(view==="risk_feature_audit")return auditLegalRiskContracts();
  if(view==="court_gap_audit")return auditCourtPracticeGaps();
  if(view==="calculations")return services.caseCalculations({caseId,limit:input.limit,offset:input.offset});
  if(view==="legal")return listCaseLawgraphReview(db(),{caseId,limit:input.limit,offset:input.offset});
  if(view==="automation")return readCaseLegalAutomation(db(),caseId);
  if(view==="updates")return services.caseUpdates({caseId,afterEventId:input.afterEventId,limit:input.limit});
  throw Object.assign(new Error("INVALID_CASE_SCHEMA_VIEW"),{code:"INVALID_CASE_SCHEMA_VIEW"});
}
