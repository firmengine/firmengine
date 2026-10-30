-- P0/F03: bound retries and leases independently per case/calculation revision.
-- A failed or not-yet-due case cannot indefinitely starve other cases.
CREATE TABLE IF NOT EXISTS case_calculation_poll_jobs (
  case_id TEXT PRIMARY KEY NOT NULL REFERENCES cases(id),
  data_version INTEGER NOT NULL,case_revision INTEGER NOT NULL,reference_sha256 TEXT NOT NULL,
  status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,lease_until TEXT,next_attempt_at TEXT,last_error TEXT,updated_at TEXT NOT NULL,
  CHECK (status IN ('running','retry_wait','failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_calculation_poll_jobs_due_idx ON case_calculation_poll_jobs(status,next_attempt_at,lease_until);
