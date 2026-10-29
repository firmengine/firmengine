CREATE TABLE IF NOT EXISTS case_mutation_receipts (
 id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL, command_id TEXT NOT NULL, request_hash TEXT NOT NULL, command_type TEXT NOT NULL, actor TEXT NOT NULL,
 before_revision INTEGER NOT NULL, after_revision INTEGER NOT NULL, before_state_hash TEXT NOT NULL, after_state_hash TEXT NOT NULL,
 before_snapshot_key TEXT NOT NULL, after_snapshot_key TEXT NOT NULL, impact_payload TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(case_id,command_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS case_recompute_jobs (
 id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL, job_kind TEXT NOT NULL, input_fingerprint TEXT NOT NULL, contract_fingerprint TEXT NOT NULL,
 status TEXT NOT NULL, lease_token TEXT, lease_until TEXT, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, next_attempt_at TEXT,
 result_ref TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(case_id,job_kind,input_fingerprint,contract_fingerprint)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_recompute_pending_idx ON case_recompute_jobs(case_id,status,next_attempt_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS case_tasks (
 id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL, dedupe_key TEXT NOT NULL, type TEXT NOT NULL, owner_id TEXT, due_at TEXT, waiting_on TEXT,
 blocked_by TEXT NOT NULL, status TEXT NOT NULL, dependency_fingerprint TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(case_id,dedupe_key)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS app_role_grants (
 actor_id TEXT NOT NULL, role TEXT NOT NULL, scope_id TEXT NOT NULL, status TEXT NOT NULL, effective_from TEXT NOT NULL, effective_to TEXT,
 granted_by TEXT NOT NULL, reason TEXT NOT NULL, policy_revision INTEGER NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT,
 PRIMARY KEY(actor_id,role,scope_id)
);
