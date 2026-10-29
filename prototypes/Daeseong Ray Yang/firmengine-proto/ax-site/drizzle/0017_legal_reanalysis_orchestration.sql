-- Derived reassessment, not a source-data trigger, filing approval, or legal admission.
CREATE TABLE IF NOT EXISTS case_legal_automation_jobs (
 id TEXT PRIMARY KEY NOT NULL,
 case_id TEXT NOT NULL REFERENCES cases(id),
 data_version INTEGER NOT NULL,
 case_revision INTEGER NOT NULL,
 calculation_run_id TEXT NOT NULL REFERENCES case_calculation_runs(id),
 input_sha256 TEXT NOT NULL,
 reference_sha256 TEXT NOT NULL,
 status TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 completed_checks INTEGER NOT NULL DEFAULT 0,
 expected_checks INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,lease_until TEXT,next_attempt_at TEXT,
 legal_review_run_id TEXT REFERENCES case_legal_review_runs(id),
 document_run_id TEXT REFERENCES case_automatic_document_runs(id),
 outcome_json TEXT NOT NULL DEFAULT '{}',
 last_error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 UNIQUE(case_id,data_version,calculation_run_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_legal_automation_due_idx ON case_legal_automation_jobs(status,next_attempt_at,lease_until);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_legal_automation_case_idx ON case_legal_automation_jobs(case_id,data_version,updated_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS case_legal_automation_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
 case_id TEXT NOT NULL REFERENCES cases(id),job_id TEXT NOT NULL REFERENCES case_legal_automation_jobs(id),
 data_version INTEGER NOT NULL,event_kind TEXT NOT NULL,payload_json TEXT NOT NULL,created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_legal_automation_events_case_idx ON case_legal_automation_events(case_id,id);
