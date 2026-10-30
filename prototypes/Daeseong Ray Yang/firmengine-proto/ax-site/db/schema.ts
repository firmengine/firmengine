import { integer, sqliteTable, text, index, uniqueIndex, primaryKey, unique, foreignKey } from "drizzle-orm/sqlite-core";

export const cases = sqliteTable("cases", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  owner: text("owner").notNull(), revision: integer("revision").notNull(),
  storageToken: text("storage_token").notNull().default(""),
  payload: text("payload").notNull(), createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull(),
  name: text("name").notNull(), sha256: text("sha256").notNull(),
  pageCount: integer("page_count").notNull(), originalKey: text("original_key"),
  ready: integer("ready").notNull().default(0), createdAt: text("created_at").notNull(),
}, t => [index("documents_case_idx").on(t.caseId)]);
export const pageJobs = sqliteTable("page_jobs", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull(), documentId: text("document_id").notNull(),
  page: integer("page").notNull(), role: text("role").notNull(), documentType: text("document_type"),
  imageKey: text("image_key"), imageHash: text("image_hash"), status: text("status").notNull(),
  stage: text("stage").notNull().default("waiting"), attempts: integer("attempts").notNull().default(0),
  leaseUntil: text("lease_until"), cacheKey: text("cache_key"), result: text("result"),
  error: text("error"), updatedAt: text("updated_at").notNull(),
}, t => [index("page_jobs_case_idx").on(t.caseId)]);
export const pageDerivatives = sqliteTable("page_derivatives", {
  id:text("id").primaryKey(),caseId:text("case_id").notNull(),documentId:text("document_id").notNull(),page:integer("page").notNull(),planId:text("plan_id").notNull().default("legacy"),sourceHash:text("source_hash").notNull(),baseImageHash:text("base_image_hash").notNull(),variantHash:text("variant_hash").notNull(),variant:text("variant").notNull(),objectKey:text("object_key").notNull(),bbox:text("bbox").notNull(),transform:text("transform").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("page_derivatives_page_idx").on(t.caseId,t.documentId,t.page)]);
export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull(), revision: integer("revision").notNull(),
  name: text("name").notNull(), kind: text("kind").notNull(), objectKey: text("object_key").notNull(),
  hash: text("hash").notNull(), mime: text("mime").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("artifacts_case_idx").on(t.caseId)]);
export const events = sqliteTable("events", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull(), actor: text("actor").notNull(),
  type: text("type").notNull(), detail: text("detail").notNull(), at: text("at").notNull(),
}, t => [index("events_case_idx").on(t.caseId)]);
export const analyses = sqliteTable("analyses", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull(), revision: integer("revision").notNull(),
  type: text("type").notNull(), payload: text("payload").notNull(), at: text("at").notNull(),
}, t => [index("analyses_case_idx").on(t.caseId)]);

export const legalReferenceReleases = sqliteTable("legal_reference_releases", {
  id: text("id").primaryKey().notNull(),
  revision: integer("revision").notNull(),
  seedSha256: text("seed_sha256").notNull(),
  sha256: text("sha256").notNull(),
  status: text("status").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
  actor: text("actor").notNull(),
  reason: text("reason").notNull(),
});

export const legalReferenceItems = sqliteTable("legal_reference_items", {
  releaseId: text("release_id").notNull(),
  id: text("id").notNull(),
  kind: text("kind").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  sha256: text("sha256").notNull(),
  payload: text("payload").notNull(),
},t=>[primaryKey({columns:[t.releaseId,t.id]}),index("legal_reference_items_kind_idx").on(t.releaseId,t.kind)]);

export const legalReferenceChanges = sqliteTable("legal_reference_changes", {
  id: text("id").primaryKey().notNull(),
  referenceId: text("reference_id").notNull(),
  status: text("status").notNull(),
  baseSha256: text("base_sha256").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
  actor: text("actor").notNull(),
  reviewedAt: text("reviewed_at"),
  reviewedBy: text("reviewed_by"),
});

export const legalMonitorObservations = sqliteTable("legal_monitor_observations", {
  sourceId: text("source_id").primaryKey().notNull(),
  sha256: text("sha256").notNull(),
  payload: text("payload").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});

export const legalMonitorObservationHistory = sqliteTable("legal_monitor_observation_history", {
  sourceId: text("source_id").notNull(),
  sha256: text("sha256").notNull(),
  payload: text("payload").notNull(),
  fetchedAt: text("fetched_at").notNull(),
},t=>[primaryKey({columns:[t.sourceId,t.sha256]})]);

export const legalMonitorRuns = sqliteTable("legal_monitor_runs", {
  id: text("id").primaryKey().notNull(),
  agent: text("agent").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  payload: text("payload").notNull(),
});

export const legalMonitorAlerts = sqliteTable("legal_monitor_alerts", {
  id: text("id").primaryKey().notNull(),
  agent: text("agent").notNull(),
  sourceId: text("source_id").notNull(),
  status: text("status").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
  acknowledgedAt: text("acknowledged_at"),
  acknowledgedBy: text("acknowledged_by"),
},t=>[index("legal_monitor_alerts_created_idx").on(t.createdAt)]);

export const legalMonitorState = sqliteTable("legal_monitor_state", {
  id: text("id").primaryKey().notNull(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const legalMonitorLocks = sqliteTable("legal_monitor_locks", {
  id: text("id").primaryKey().notNull(),
  token: text("token").notNull(),
  expiresAt: text("expires_at").notNull(),
});

// A separate, versioned reference schema for consultation intake. The payload
// contains typed feature, document, rule and source collections; case facts and
// calculation inputs are deliberately not stored or changed by this module.
export const intakeCatalogVersions = sqliteTable("intake_catalog_versions", {
  version: integer("version").primaryKey(), schemaVersion:text("schema_version").notNull(),
  payload:text("payload").notNull(), sha256:text("sha256").notNull(),
  actor:text("actor").notNull(), createdAt:text("created_at").notNull(),
});
export const intakeCatalogHead = sqliteTable("intake_catalog_head", {
  id:text("id").primaryKey(), version:integer("version").notNull(), sha256:text("sha256").notNull(),
});
export const consultationHeads = sqliteTable("consultation_heads", {
  caseId:text("case_id").primaryKey(), revision:integer("revision").notNull().default(0),
  activeRunId:text("active_run_id"), updatedAt:text("updated_at").notNull(),
});
export const consultationNotes = sqliteTable("consultation_notes", {
  id:text("id").primaryKey(), caseId:text("case_id").notNull(), sequence:integer("sequence").notNull(),
  text:text("text").notNull(), textSha256:text("text_sha256").notNull(), occurredAt:text("occurred_at"),
  supersedesId:text("supersedes_id"), actor:text("actor").notNull(), createdAt:text("created_at").notNull(),
}, t=>[index("consultation_notes_case_idx").on(t.caseId,t.sequence)]);
export const consultationRuns = sqliteTable("consultation_runs", {
  id:text("id").primaryKey(), caseId:text("case_id").notNull(), fingerprint:text("fingerprint").notNull().unique(),
  caseRevision:integer("case_revision").notNull(), caseStorageToken:text("case_storage_token").notNull(),
  consultationRevision:integer("consultation_revision").notNull(), catalogVersion:integer("catalog_version").notNull(),
  status:text("status").notNull(), leaseUntil:text("lease_until"), payload:text("payload"), payloadSha256:text("payload_sha256"), error:text("error"),
  actor:text("actor").notNull(), createdAt:text("created_at").notNull(), updatedAt:text("updated_at").notNull(),
},t=>[index("consultation_runs_case_idx").on(t.caseId,t.createdAt)]);

export const caseMutationReceipts = sqliteTable("case_mutation_receipts", {
  id:text("id").primaryKey().notNull(), caseId:text("case_id").notNull(), commandId:text("command_id").notNull(),
  requestHash:text("request_hash").notNull(), commandType:text("command_type").notNull(), actor:text("actor").notNull(),
  beforeRevision:integer("before_revision").notNull(), afterRevision:integer("after_revision").notNull(),
  beforeStateHash:text("before_state_hash").notNull(), afterStateHash:text("after_state_hash").notNull(),
  beforeSnapshotKey:text("before_snapshot_key").notNull(), afterSnapshotKey:text("after_snapshot_key").notNull(),
  impactPayload:text("impact_payload").notNull(), createdAt:text("created_at").notNull(),
},t=>[unique("case_mutation_receipts_case_command_unique").on(t.caseId,t.commandId)]);

export const caseRecomputeJobs = sqliteTable("case_recompute_jobs", {
  id:text("id").primaryKey().notNull(),caseId:text("case_id").notNull(),jobKind:text("job_kind").notNull(),
  inputFingerprint:text("input_fingerprint").notNull(),contractFingerprint:text("contract_fingerprint").notNull(),
  status:text("status").notNull(),leaseToken:text("lease_token"),leaseUntil:text("lease_until"),
  attempts:integer("attempts").notNull().default(0),lastError:text("last_error"),nextAttemptAt:text("next_attempt_at"),
  resultRef:text("result_ref"),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[unique("case_recompute_jobs_identity_unique").on(t.caseId,t.jobKind,t.inputFingerprint,t.contractFingerprint),index("case_recompute_pending_idx").on(t.caseId,t.status,t.nextAttemptAt)]);

export const caseTasks = sqliteTable("case_tasks", {
  id:text("id").primaryKey().notNull(),caseId:text("case_id").notNull(),dedupeKey:text("dedupe_key").notNull(),type:text("type").notNull(),
  ownerId:text("owner_id"),dueAt:text("due_at"),waitingOn:text("waiting_on"),blockedBy:text("blocked_by").notNull(),
  status:text("status").notNull(),dependencyFingerprint:text("dependency_fingerprint").notNull(),payload:text("payload").notNull(),
  createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[unique("case_tasks_case_dedupe_unique").on(t.caseId,t.dedupeKey)]);

export const appRoleGrants = sqliteTable("app_role_grants", {
  actorId:text("actor_id").notNull(),role:text("role").notNull(),scopeId:text("scope_id").notNull(),status:text("status").notNull(),
  effectiveFrom:text("effective_from").notNull(),effectiveTo:text("effective_to"),grantedBy:text("granted_by").notNull(),reason:text("reason").notNull(),
  policyRevision:integer("policy_revision").notNull(),createdAt:text("created_at").notNull(),revokedAt:text("revoked_at"),
},t=>[primaryKey({columns:[t.actorId,t.role,t.scopeId]})]);

// Public document identities and consultation-selected requirement rows. The
// immutable catalogue/run payloads remain available alongside typed columns.
export const sharedDocumentTypes=sqliteTable("shared_document_types",{
  id:text("id").primaryKey().notNull(),name:text("name").notNull(),category:text("category").notNull(),
  issuer:text("issuer").notNull(),purpose:text("purpose").notNull(),collectionMode:text("collection_mode").notNull(),routingStatus:text("routing_status").notNull(),
  catalogVersion:integer("catalog_version").notNull().references(()=>intakeCatalogVersions.version),catalogSha256:text("catalog_sha256").notNull(),
  active:integer("active").notNull().default(1),payloadJson:text("payload_json").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[index("shared_document_types_active_idx").on(t.active,t.catalogSha256)]);
export const sharedDocumentTypeVersions=sqliteTable("shared_document_type_versions",{
  catalogSha256:text("catalog_sha256").notNull(),documentTypeId:text("document_type_id").notNull().references(()=>sharedDocumentTypes.id),
  catalogVersion:integer("catalog_version").notNull().references(()=>intakeCatalogVersions.version),name:text("name").notNull(),category:text("category").notNull(),
  issuer:text("issuer").notNull(),purpose:text("purpose").notNull(),collectionMode:text("collection_mode").notNull(),routingStatus:text("routing_status").notNull(),
  payloadJson:text("payload_json").notNull(),createdAt:text("created_at").notNull(),
},t=>[primaryKey({columns:[t.catalogSha256,t.documentTypeId]}),index("shared_document_type_versions_type_idx").on(t.documentTypeId,t.catalogVersion)]);
export const caseDocumentRequirements=sqliteTable("case_document_requirements",{
  consultationRunId:text("consultation_run_id").notNull().references(()=>consultationRuns.id),requirementId:text("requirement_id").notNull(),
  caseId:text("case_id").notNull().references(()=>cases.id),documentTypeId:text("document_type_id").notNull().references(()=>sharedDocumentTypes.id),
  documentName:text("document_name").notNull(),subjectId:text("subject_id").notNull(),subjectLabel:text("subject_label").notNull(),requiredPeriod:text("required_period").notNull(),
  requirement:text("requirement").notNull(),status:text("status").notNull(),catalogVersion:integer("catalog_version").notNull().references(()=>intakeCatalogVersions.version),
  catalogSha256:text("catalog_sha256").notNull(),rawJson:text("raw_json").notNull(),rawSha256:text("raw_sha256").notNull(),createdAt:text("created_at").notNull(),
},t=>[primaryKey({columns:[t.consultationRunId,t.requirementId]}),foreignKey({columns:[t.catalogSha256,t.documentTypeId],foreignColumns:[sharedDocumentTypeVersions.catalogSha256,sharedDocumentTypeVersions.documentTypeId]}),index("case_document_requirements_case_idx").on(t.caseId,t.consultationRunId,t.status),index("case_document_requirements_type_idx").on(t.documentTypeId,t.caseId)]);


export const caseRequirementFieldPlans = sqliteTable("case_requirement_field_plans", {
  consultationRunId:text("consultation_run_id").notNull().references(()=>consultationRuns.id),
  requirementId:text("requirement_id").notNull(),
  caseId:text("case_id").notNull().references(()=>cases.id),
  documentTypeId:text("document_type_id").notNull().references(()=>sharedDocumentTypes.id),
  catalogSha256:text("catalog_sha256").notNull(),
  schemaVersion:text("schema_version").notNull(),
  routingStatus:text("routing_status").notNull(),
  mappingStatus:text("mapping_status").notNull(),
  planJson:text("plan_json").notNull(),
  planSha256:text("plan_sha256").notNull(),
  createdAt:text("created_at").notNull(),
},t=>[
  primaryKey({columns:[t.consultationRunId,t.requirementId]}),
  foreignKey({columns:[t.consultationRunId,t.requirementId],foreignColumns:[caseDocumentRequirements.consultationRunId,caseDocumentRequirements.requirementId]}),
  index("case_requirement_field_plans_case_idx").on(t.caseId,t.consultationRunId,t.documentTypeId),
]);


export const caseDocumentWorkEvents=sqliteTable("case_document_work_events",{
  id:integer("id").primaryKey({autoIncrement:true}).notNull(),
  caseId:text("case_id").notNull().references(()=>cases.id),
  eventKind:text("event_kind").notNull(),sourceId:text("source_id").notNull(),
  beforeState:text("before_state"),afterState:text("after_state"),
  occurredAt:text("occurred_at").notNull(),
},t=>[index("case_document_work_events_case_cursor_idx").on(t.caseId,t.id)]);

// Immutable source extraction schemas and row observations. These tables do not
// grant fact verification, legal recognition, or court approval.
export const extractionSchemaVersions = sqliteTable("extraction_schema_versions", {
  id:text("id").primaryKey().notNull(),sha256:text("sha256").notNull(),documentTypeId:text("document_type_id"),
  familyId:text("family_id"),contractVersion:text("contract_version").notNull(),payloadJson:text("payload_json").notNull(),createdAt:text("created_at").notNull(),
});
export const extractionSchemaFields = sqliteTable("extraction_schema_fields", {
  schemaId:text("schema_id").notNull(),canonicalFieldId:text("canonical_field_id").notNull(),ordinal:integer("ordinal").notNull(),
  localKey:text("local_key").notNull(),label:text("label").notNull(),datatype:text("datatype").notNull(),unit:text("unit").notNull(),
  subjectRole:text("subject_role").notNull(),partyRole:text("party_role").notNull(),temporalRole:text("temporal_role").notNull(),
  amountOwnerRole:text("amount_owner_role"),definitionJson:text("definition_json").notNull(),
},t=>[primaryKey({columns:[t.schemaId,t.canonicalFieldId]}),index("extraction_schema_fields_key_idx").on(t.schemaId,t.localKey)]);
export const documentInstances = sqliteTable("document_instances", {
  id:text("id").primaryKey().notNull(),caseId:text("case_id").notNull(),sourceDocumentId:text("source_document_id").notNull(),page:integer("page").notNull(),
  sharedDocumentTypeId:text("shared_document_type_id"),sharedDocumentTypeName:text("shared_document_type_name"),familyId:text("family_id"),
  boundaryStatus:text("boundary_status").notNull(),catalogVersion:integer("catalog_version"),catalogSha256:text("catalog_sha256"),createdAt:text("created_at").notNull(),
},t=>[index("document_instances_case_type_idx").on(t.caseId,t.sharedDocumentTypeId)]);
export const extractionRuns = sqliteTable("extraction_runs", {
  id:text("id").primaryKey().notNull(),caseId:text("case_id").notNull(),documentInstanceId:text("document_instance_id").notNull(),schemaId:text("schema_id").notNull(),
  pageJobId:text("page_job_id"),stage:text("stage").notNull(),model:text("model").notNull(),sourceHash:text("source_hash").notNull(),imageHash:text("image_hash").notNull(),
  readSha256:text("read_sha256").notNull(),readJson:text("read_json").notNull(),caseRevision:integer("case_revision").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("extraction_runs_case_idx").on(t.caseId,t.createdAt)]);
export const extractionRecords = sqliteTable("extraction_records", {
  id:text("id").primaryKey().notNull(),runId:text("run_id").notNull(),ordinal:integer("ordinal").notNull(),category:text("category").notNull(),label:text("label").notNull(),
},t=>[unique("extraction_records_run_ordinal_unique").on(t.runId,t.ordinal)]);
export const extractedFeatures = sqliteTable("extracted_features", {
  id:text("id").primaryKey().notNull(),recordId:text("record_id").notNull(),schemaId:text("schema_id").notNull(),ordinal:integer("ordinal").notNull(),
  canonicalFieldId:text("canonical_field_id"),fieldKey:text("field_key").notNull(),label:text("label").notNull(),rawValueJson:text("raw_value_json").notNull(),unit:text("unit"),
  sourceState:text("source_state"),confidence:text("confidence").notNull(),quote:text("quote"),bboxJson:text("bbox_json").notNull(),rawFieldJson:text("raw_field_json").notNull(),
  bindingStatus:text("binding_status").notNull(),validationStatus:text("validation_status").notNull(),validationJson:text("validation_json").notNull(),
  projectionKey:text("projection_key"),bindingVersion:text("binding_version").notNull().default("legacy"),
},t=>[unique("extracted_features_record_ordinal_unique").on(t.recordId,t.ordinal),index("extracted_features_canonical_idx").on(t.schemaId,t.canonicalFieldId)]);
// Page-level expected-field coverage, without fabricated observed-value rows.
export const extractionFieldCoverage = sqliteTable("extraction_field_coverage", {
  runId:text("run_id").notNull().references(()=>extractionRuns.id),
  schemaId:text("schema_id").notNull().references(()=>extractionSchemaVersions.id),
  canonicalFieldId:text("canonical_field_id").notNull(),observationStatus:text("observation_status").notNull(),
  observedCount:integer("observed_count").notNull(),reviewCount:integer("review_count").notNull(),
  sourceStateCountsJson:text("source_state_counts_json").notNull(),createdAt:text("created_at").notNull(),
},t=>[primaryKey({columns:[t.runId,t.canonicalFieldId]}),
  foreignKey({columns:[t.schemaId,t.canonicalFieldId],foreignColumns:[extractionSchemaFields.schemaId,extractionSchemaFields.canonicalFieldId]}),
  index("extraction_field_coverage_status_idx").on(t.schemaId,t.observationStatus)]);
export const caseExtractionHeads = sqliteTable("case_extraction_heads", {
  caseId:text("case_id").notNull(),sourceDocumentId:text("source_document_id").notNull(),page:integer("page").notNull(),runId:text("run_id").notNull(),
  caseRevision:integer("case_revision").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[primaryKey({columns:[t.caseId,t.sourceDocumentId,t.page]})]);

// Append-only source-data notifications. SQL triggers maintain these counters;
// model/calculation/review output tables deliberately do not reset the quiet window.
export const caseDataChangeEvents=sqliteTable("case_data_change_events",{
  id:integer("id").primaryKey({autoIncrement:true}).notNull(),caseId:text("case_id").notNull(),
  tableName:text("table_name").notNull(),rowId:text("row_id").notNull(),operation:text("operation").notNull(),
  eventKind:text("event_kind").notNull(),caseRevision:integer("case_revision"),changedAt:text("changed_at").notNull(),
},t=>[index("case_data_change_events_case_cursor_idx").on(t.caseId,t.id)]);
export const caseDataChangeState=sqliteTable("case_data_change_state",{
  caseId:text("case_id").primaryKey().notNull(),dataVersion:integer("data_version").notNull(),
  lastEventId:integer("last_event_id").notNull(),lastCaseRevision:integer("last_case_revision"),lastChangedAt:text("last_changed_at").notNull(),
});
export const caseCalculationRuns = sqliteTable("case_calculation_runs", {
  id:text("id").primaryKey().notNull(),caseId:text("case_id").notNull(),dataVersion:integer("data_version").notNull(),caseRevision:integer("case_revision").notNull(),
  inputSha256:text("input_sha256").notNull(),ruleReleaseId:text("rule_release_id").notNull(),referenceId:text("reference_id").notNull(),referenceRevision:integer("reference_revision").notNull(),
  referenceSha256:text("reference_sha256").notNull(),contractVersion:text("contract_version").notNull(),status:text("status").notNull(),missingJson:text("missing_json").notNull(),
  rawResultJson:text("raw_result_json").notNull(),sourceHeadsJson:text("source_heads_json").notNull(),sourceHeadsSha256:text("source_heads_sha256").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("case_calculation_runs_case_version_idx").on(t.caseId,t.dataVersion,t.caseRevision)]);
export const caseCalculationFeatures = sqliteTable("case_calculation_features", {
  id:text("id").primaryKey().notNull(),runId:text("run_id").notNull(),calculationId:text("calculation_id").notNull(),outputName:text("output_name").notNull(),outputPath:text("output_path").notNull(),
  subjectId:text("subject_id"),rowOrdinal:integer("row_ordinal"),valueJson:text("value_json").notNull(),valueWon:text("value_won"),status:text("status").notNull(),
  sourceFactIdsJson:text("source_fact_ids_json").notNull(),inputRefsJson:text("input_refs_json").notNull(),formula:text("formula").notNull(),
},t=>[index("case_calculation_features_output_idx").on(t.runId,t.calculationId,t.outputName)]);
export const caseCalculationPollJobs=sqliteTable("case_calculation_poll_jobs",{
 caseId:text("case_id").primaryKey().references(()=>cases.id),dataVersion:integer("data_version").notNull(),
 caseRevision:integer("case_revision").notNull(),referenceSha256:text("reference_sha256").notNull(),
 status:text("status").notNull(),attempts:integer("attempts").notNull().default(0),
 leaseToken:text("lease_token"),leaseUntil:text("lease_until"),nextAttemptAt:text("next_attempt_at"),
 lastError:text("last_error"),updatedAt:text("updated_at").notNull(),
},t=>[index("case_calculation_poll_jobs_due_idx").on(t.status,t.nextAttemptAt,t.leaseUntil)]);
export const caseCalculationHeads = sqliteTable("case_calculation_heads", {
  caseId:text("case_id").primaryKey().notNull(),runId:text("run_id").notNull(),dataVersion:integer("data_version").notNull(),caseRevision:integer("case_revision").notNull(),
  inputSha256:text("input_sha256").notNull(),updatedAt:text("updated_at").notNull(),
});
export const caseLegalAutomationJobs=sqliteTable("case_legal_automation_jobs",{
 id:text("id").primaryKey(),caseId:text("case_id").notNull().references(()=>cases.id),
 dataVersion:integer("data_version").notNull(),caseRevision:integer("case_revision").notNull(),
 calculationRunId:text("calculation_run_id").notNull().references(()=>caseCalculationRuns.id),
 inputSha256:text("input_sha256").notNull(),referenceSha256:text("reference_sha256").notNull(),
 status:text("status").notNull(),attempts:integer("attempts").notNull().default(0),
 completedChecks:integer("completed_checks").notNull().default(0),expectedChecks:integer("expected_checks").notNull().default(0),
 leaseToken:text("lease_token"),leaseUntil:text("lease_until"),nextAttemptAt:text("next_attempt_at"),
 legalReviewRunId:text("legal_review_run_id").references(()=>caseLegalReviewRuns.id),
 documentRunId:text("document_run_id").references(()=>caseAutomaticDocumentRuns.id),
 outcomeJson:text("outcome_json").notNull().default("{}"),lastError:text("last_error"),
 createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[uniqueIndex("case_legal_automation_version_idx").on(t.caseId,t.dataVersion,t.calculationRunId),
 index("case_legal_automation_due_idx").on(t.status,t.nextAttemptAt,t.leaseUntil)]);
export const caseLegalAutomationEvents=sqliteTable("case_legal_automation_events",{
 id:integer("id").primaryKey({autoIncrement:true}),caseId:text("case_id").notNull().references(()=>cases.id),
 jobId:text("job_id").notNull().references(()=>caseLegalAutomationJobs.id),dataVersion:integer("data_version").notNull(),
 eventKind:text("event_kind").notNull(),payloadJson:text("payload_json").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("case_legal_automation_events_case_idx").on(t.caseId,t.id)]);
export const caseLegalReviewRuns=sqliteTable("case_legal_review_runs",{
  id:text("id").primaryKey().notNull(),caseId:text("case_id").notNull(),dataVersion:integer("data_version").notNull(),caseRevision:integer("case_revision").notNull(),
  calculationRunId:text("calculation_run_id").notNull(),inputSha256:text("input_sha256").notNull(),model:text("model").notNull(),status:text("status").notNull(),
  complete:integer("complete").notNull(),expectedCheckIdsJson:text("expected_check_ids_json").notNull(),summary:text("summary").notNull(),rawResultJson:text("raw_result_json").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("case_legal_review_runs_case_idx").on(t.caseId,t.dataVersion,t.caseRevision)]);
export const caseLegalConditions=sqliteTable("case_legal_conditions",{
  id:text("id").primaryKey().notNull(),reviewRunId:text("review_run_id").notNull(),ordinal:integer("ordinal").notNull(),conditionId:text("condition_id").notNull(),status:text("status").notNull(),reason:text("reason").notNull(),
  sourceFactIdsJson:text("source_fact_ids_json").notNull(),ruleIdsJson:text("rule_ids_json").notNull(),missingDocumentsJson:text("missing_documents_json").notNull(),nextAction:text("next_action").notNull(),
},t=>[unique("case_legal_conditions_run_condition_unique").on(t.reviewRunId,t.conditionId)]);
export const caseDocumentFieldValues=sqliteTable("case_document_field_values",{
  id:text("id").primaryKey().notNull(),reviewRunId:text("review_run_id").notNull(),ordinal:integer("ordinal").notNull(),formCode:text("form_code").notNull(),artifactKind:text("artifact_kind").notNull(),token:text("token").notNull(),
  subjectId:text("subject_id"),rowOrdinal:integer("row_ordinal"),valueJson:text("value_json").notNull(),valueKind:text("value_kind").notNull(),sourceFactIdsJson:text("source_fact_ids_json").notNull(),calculationFeatureRefsJson:text("calculation_feature_refs_json").notNull(),citationJson:text("citation_json").notNull(),
},t=>[unique("case_document_field_values_run_ordinal_unique").on(t.reviewRunId,t.ordinal),index("case_document_field_values_token_idx").on(t.reviewRunId,t.formCode,t.token,t.subjectId)]);
export const caseLegalReviewHeads=sqliteTable("case_legal_review_heads",{
  caseId:text("case_id").primaryKey().notNull(),reviewRunId:text("review_run_id").notNull(),dataVersion:integer("data_version").notNull(),caseRevision:integer("case_revision").notNull(),calculationRunId:text("calculation_run_id").notNull(),inputSha256:text("input_sha256").notNull(),updatedAt:text("updated_at").notNull(),
});
export const caseAutomaticDocumentRuns=sqliteTable("case_automatic_document_runs",{
  id:text("id").primaryKey().notNull(),caseId:text("case_id").notNull(),legalReviewRunId:text("legal_review_run_id").notNull().unique(),dataVersion:integer("data_version").notNull(),caseRevision:integer("case_revision").notNull(),status:text("status").notNull(),artifactsJson:text("artifacts_json").notNull(),reason:text("reason"),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull(),
});

/** Reversible deterministic substitute monitoring. Original histories are immutable. */
export const caseSubstitutionWatchHeads=sqliteTable("case_substitution_watch_heads",{
  caseId:text("case_id").primaryKey().notNull().references(()=>cases.id),
  caseRevision:integer("case_revision").notNull(),sourceDataVersion:integer("source_data_version").notNull(),
  catalogVersion:integer("catalog_version").notNull(),policySignal:text("policy_signal").notNull(),
  activeRequirementIdsJson:text("active_requirement_ids_json").notNull(),nextScanAt:text("next_scan_at"),
  scannedAt:text("scanned_at").notNull(),
});
export const caseSubstitutionRequestStates=sqliteTable("case_substitution_request_states",{
  caseId:text("case_id").notNull().references(()=>cases.id),requirementId:text("requirement_id").notNull(),
  intakeRunId:text("intake_run_id").notNull(),originalDocumentTypeId:text("original_document_type_id").notNull(),
  decisionStatus:text("decision_status").notNull(),activeRequest:integer("active_request").notNull(),
  missingFieldsJson:text("missing_fields_json").notNull(),reasonCodesJson:text("reason_codes_json").notNull(),
  supportDocumentIdsJson:text("support_document_ids_json").notNull(),evaluatedFingerprint:text("evaluated_fingerprint").notNull(),
  caseRevision:integer("case_revision").notNull(),sourceDataVersion:integer("source_data_version").notNull(),
  catalogVersion:integer("catalog_version").notNull(),evaluatedAt:text("evaluated_at").notNull(),
},t=>[primaryKey({columns:[t.caseId,t.requirementId]}),index("case_substitution_request_states_active_idx").on(t.caseId,t.activeRequest,t.decisionStatus)]);
export const caseSubstitutionTransitionEvents=sqliteTable("case_substitution_transition_events",{
  id:integer("id").primaryKey({autoIncrement:true}),caseId:text("case_id").notNull().references(()=>cases.id),
  requirementId:text("requirement_id").notNull(),originalDocumentTypeId:text("original_document_type_id").notNull(),
  fromStatus:text("from_status"),toStatus:text("to_status").notNull(),fromActiveRequest:integer("from_active_request"),
  toActiveRequest:integer("to_active_request").notNull(),caseRevision:integer("case_revision").notNull(),
  sourceDataVersion:integer("source_data_version").notNull(),dependencyFingerprint:text("dependency_fingerprint").notNull(),
  reasonCodesJson:text("reason_codes_json").notNull(),occurredAt:text("occurred_at").notNull(),
},t=>[unique("case_substitution_transition_events_identity").on(t.caseId,t.requirementId,t.dependencyFingerprint,t.toStatus,t.toActiveRequest),
 index("case_substitution_transitions_case_idx").on(t.caseId,t.id)]);
