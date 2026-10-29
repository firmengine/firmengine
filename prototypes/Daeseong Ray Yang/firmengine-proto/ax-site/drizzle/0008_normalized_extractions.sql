CREATE TABLE IF NOT EXISTS extraction_schema_versions (
 id TEXT PRIMARY KEY NOT NULL, sha256 TEXT NOT NULL, document_type_id TEXT, family_id TEXT,
 contract_version TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS extraction_schema_fields (
 schema_id TEXT NOT NULL REFERENCES extraction_schema_versions(id), canonical_field_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
 local_key TEXT NOT NULL, label TEXT NOT NULL, datatype TEXT NOT NULL, unit TEXT NOT NULL,
 subject_role TEXT NOT NULL, party_role TEXT NOT NULL, temporal_role TEXT NOT NULL, amount_owner_role TEXT, definition_json TEXT NOT NULL,
 PRIMARY KEY(schema_id,canonical_field_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS extraction_schema_fields_key_idx ON extraction_schema_fields(schema_id,local_key);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS document_instances (
 id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES cases(id), source_document_id TEXT NOT NULL REFERENCES documents(id), page INTEGER NOT NULL,
 shared_document_type_id TEXT, shared_document_type_name TEXT, family_id TEXT, boundary_status TEXT NOT NULL,
 catalog_version INTEGER, catalog_sha256 TEXT, created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS document_instances_case_type_idx ON document_instances(case_id,shared_document_type_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS extraction_runs (
 id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES cases(id), document_instance_id TEXT NOT NULL REFERENCES document_instances(id),
 schema_id TEXT NOT NULL REFERENCES extraction_schema_versions(id), page_job_id TEXT, stage TEXT NOT NULL, model TEXT NOT NULL,
 source_hash TEXT NOT NULL, image_hash TEXT NOT NULL, read_sha256 TEXT NOT NULL, read_json TEXT NOT NULL, case_revision INTEGER NOT NULL, created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS extraction_runs_case_idx ON extraction_runs(case_id,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS extraction_records (
 id TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL REFERENCES extraction_runs(id), ordinal INTEGER NOT NULL, category TEXT NOT NULL, label TEXT NOT NULL,
 UNIQUE(run_id,ordinal)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS extracted_features (
 id TEXT PRIMARY KEY NOT NULL, record_id TEXT NOT NULL REFERENCES extraction_records(id), schema_id TEXT NOT NULL REFERENCES extraction_schema_versions(id),
 ordinal INTEGER NOT NULL, canonical_field_id TEXT, field_key TEXT NOT NULL, label TEXT NOT NULL, raw_value_json TEXT NOT NULL, unit TEXT,
 source_state TEXT, confidence TEXT NOT NULL, quote TEXT, bbox_json TEXT NOT NULL, raw_field_json TEXT NOT NULL,
 binding_status TEXT NOT NULL, validation_status TEXT NOT NULL, validation_json TEXT NOT NULL,
 UNIQUE(record_id,ordinal), FOREIGN KEY(schema_id,canonical_field_id) REFERENCES extraction_schema_fields(schema_id,canonical_field_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS extracted_features_canonical_idx ON extracted_features(schema_id,canonical_field_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS case_extraction_heads (
 case_id TEXT NOT NULL REFERENCES cases(id), source_document_id TEXT NOT NULL REFERENCES documents(id), page INTEGER NOT NULL,
 run_id TEXT NOT NULL REFERENCES extraction_runs(id), case_revision INTEGER NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(case_id,source_document_id,page)
);
