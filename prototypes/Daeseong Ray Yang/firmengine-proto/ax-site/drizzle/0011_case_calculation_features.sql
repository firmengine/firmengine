-- Deterministic derived outputs are immutable and deliberately not source-watch inputs.
CREATE TABLE IF NOT EXISTS case_calculation_runs (
 id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES cases(id), data_version INTEGER NOT NULL, case_revision INTEGER NOT NULL,
 input_sha256 TEXT NOT NULL, rule_release_id TEXT NOT NULL, reference_id TEXT NOT NULL, reference_revision INTEGER NOT NULL,
 reference_sha256 TEXT NOT NULL, contract_version TEXT NOT NULL, status TEXT NOT NULL, missing_json TEXT NOT NULL,
 raw_result_json TEXT NOT NULL, source_heads_json TEXT NOT NULL, source_heads_sha256 TEXT NOT NULL, created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_calculation_runs_case_version_idx ON case_calculation_runs(case_id,data_version,case_revision);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS case_calculation_features (
 id TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL REFERENCES case_calculation_runs(id), calculation_id TEXT NOT NULL,
 output_name TEXT NOT NULL, output_path TEXT NOT NULL, subject_id TEXT, row_ordinal INTEGER, value_json TEXT NOT NULL,
 value_won TEXT, status TEXT NOT NULL, source_fact_ids_json TEXT NOT NULL, input_refs_json TEXT NOT NULL, formula TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_calculation_features_output_idx ON case_calculation_features(run_id,calculation_id,output_name);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS case_calculation_heads (
 case_id TEXT PRIMARY KEY NOT NULL REFERENCES cases(id), run_id TEXT NOT NULL REFERENCES case_calculation_runs(id),
 data_version INTEGER NOT NULL, case_revision INTEGER NOT NULL, input_sha256 TEXT NOT NULL, updated_at TEXT NOT NULL
);
