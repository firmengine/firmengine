-- Additive, append-only PRE-APPROVAL court correction itemization.
-- Does NOT change cases, legal decisions, original OCR facts or existing workflow transitions.
-- Only a human caseworker with an authenticated grant may create a draft item revision.
CREATE TABLE IF NOT EXISTS case_court_correction_item_versions (
 id TEXT PRIMARY KEY NOT NULL,
 case_id TEXT NOT NULL REFERENCES cases(id),
 court_event_id TEXT NOT NULL,
 item_no INTEGER NOT NULL CHECK(item_no>=1 AND item_no<=500),
 case_revision INTEGER NOT NULL,
 source_data_version INTEGER NOT NULL,
 order_document_id TEXT NOT NULL REFERENCES documents(id),
 order_document_sha256 TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_correction_item_version_history
 ON case_court_correction_item_versions(case_id,court_event_id,item_no,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS case_court_correction_item_heads (
 case_id TEXT NOT NULL REFERENCES cases(id),
 court_event_id TEXT NOT NULL,
 item_no INTEGER NOT NULL,
 version_id TEXT NOT NULL REFERENCES case_court_correction_item_versions(id),
 source_case_revision INTEGER NOT NULL,
 source_data_version INTEGER NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(case_id,court_event_id,item_no)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_correction_item_head_source_version
 ON case_court_correction_item_heads(case_id,source_data_version);
