-- A4: durable per-request export identity, proposal only until route and CAS
-- batch integration is reviewed. Historical committed requests are never
-- recycled or promoted to the current export after a later regeneration.
CREATE TABLE IF NOT EXISTS case_export_request_receipts (
  case_id TEXT NOT NULL REFERENCES cases(id),
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('draft','final')),
  case_revision INTEGER NOT NULL CHECK(case_revision >= 1),
  source_data_version INTEGER NOT NULL CHECK(source_data_version >= 1),
  reference_sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('claimed','committed','uncertain','failed')),
  claim_token TEXT NOT NULL,
  artifact_ids_json TEXT,
  manifest_fingerprint TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  committed_at TEXT,
  PRIMARY KEY(case_id, request_id),
  CHECK((status='committed' AND artifact_ids_json IS NOT NULL AND json_valid(artifact_ids_json)=1 AND manifest_fingerprint IS NOT NULL AND committed_at IS NOT NULL)
     OR (status<>'committed' AND committed_at IS NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_export_request_receipts_status_idx
  ON case_export_request_receipts(case_id,status,updated_at);
