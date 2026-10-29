-- Reversible case-scoped substitution watcher. Never deletes source, runs or catalogue.
-- These are materialized request-visibility projections, not legal acceptance.
CREATE TABLE IF NOT EXISTS case_substitution_watch_heads (
  case_id TEXT PRIMARY KEY NOT NULL REFERENCES cases(id),
  case_revision INTEGER NOT NULL,
  source_data_version INTEGER NOT NULL,
  catalog_version INTEGER NOT NULL,
  policy_signal TEXT NOT NULL,
  active_requirement_ids_json TEXT NOT NULL,
  next_scan_at TEXT,
  scanned_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS case_substitution_request_states (
  case_id TEXT NOT NULL REFERENCES cases(id),
  requirement_id TEXT NOT NULL,
  intake_run_id TEXT NOT NULL,
  original_document_type_id TEXT NOT NULL,
  decision_status TEXT NOT NULL CHECK(decision_status IN ('original_required','review_required','partial','inactive_by_substitution','restored')),
  active_request INTEGER NOT NULL CHECK(active_request IN (0,1)),
  missing_fields_json TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL,
  support_document_ids_json TEXT NOT NULL,
  evaluated_fingerprint TEXT NOT NULL,
  case_revision INTEGER NOT NULL,
  source_data_version INTEGER NOT NULL,
  catalog_version INTEGER NOT NULL,
  evaluated_at TEXT NOT NULL,
  PRIMARY KEY (case_id, requirement_id)
);
CREATE INDEX IF NOT EXISTS case_substitution_request_states_active_idx ON case_substitution_request_states(case_id,active_request,decision_status);
CREATE TABLE IF NOT EXISTS case_substitution_transition_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(id),
  requirement_id TEXT NOT NULL,
  original_document_type_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  from_active_request INTEGER,
  to_active_request INTEGER NOT NULL CHECK(to_active_request IN (0,1)),
  case_revision INTEGER NOT NULL,
  source_data_version INTEGER NOT NULL,
  dependency_fingerprint TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  UNIQUE(case_id,requirement_id,dependency_fingerprint,to_status,to_active_request)
);
CREATE INDEX IF NOT EXISTS case_substitution_transitions_case_idx ON case_substitution_transition_events(case_id,id);
