-- Model-assisted review and generated draft fields are derived outputs, not source-watch inputs.
CREATE TABLE IF NOT EXISTS case_legal_review_runs (
 id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES cases(id), data_version INTEGER NOT NULL, case_revision INTEGER NOT NULL,
 calculation_run_id TEXT NOT NULL REFERENCES case_calculation_runs(id), input_sha256 TEXT NOT NULL, model TEXT NOT NULL,
 status TEXT NOT NULL, complete INTEGER NOT NULL, expected_check_ids_json TEXT NOT NULL, summary TEXT NOT NULL, raw_result_json TEXT NOT NULL, created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_legal_review_runs_case_idx ON case_legal_review_runs(case_id,data_version,case_revision);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS case_legal_conditions (
 id TEXT PRIMARY KEY NOT NULL, review_run_id TEXT NOT NULL REFERENCES case_legal_review_runs(id), ordinal INTEGER NOT NULL, condition_id TEXT NOT NULL,
 status TEXT NOT NULL, reason TEXT NOT NULL, source_fact_ids_json TEXT NOT NULL, rule_ids_json TEXT NOT NULL, missing_documents_json TEXT NOT NULL, next_action TEXT NOT NULL,
 UNIQUE(review_run_id,condition_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS case_document_field_values (
 id TEXT PRIMARY KEY NOT NULL, review_run_id TEXT NOT NULL REFERENCES case_legal_review_runs(id), ordinal INTEGER NOT NULL, form_code TEXT NOT NULL,
 artifact_kind TEXT NOT NULL, token TEXT NOT NULL, subject_id TEXT, row_ordinal INTEGER, value_json TEXT NOT NULL, value_kind TEXT NOT NULL,
 source_fact_ids_json TEXT NOT NULL, calculation_feature_refs_json TEXT NOT NULL, citation_json TEXT NOT NULL, UNIQUE(review_run_id,ordinal)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_document_field_values_token_idx ON case_document_field_values(review_run_id,form_code,token,subject_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS case_legal_review_heads (
 case_id TEXT PRIMARY KEY NOT NULL REFERENCES cases(id), review_run_id TEXT NOT NULL REFERENCES case_legal_review_runs(id),
 data_version INTEGER NOT NULL, case_revision INTEGER NOT NULL, calculation_run_id TEXT NOT NULL REFERENCES case_calculation_runs(id), input_sha256 TEXT NOT NULL, updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS case_automatic_document_runs (
 id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES cases(id), legal_review_run_id TEXT NOT NULL UNIQUE REFERENCES case_legal_review_runs(id),
 data_version INTEGER NOT NULL, case_revision INTEGER NOT NULL, status TEXT NOT NULL, artifacts_json TEXT NOT NULL, reason TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
