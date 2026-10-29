-- Immutable per-case, per-consultation-run field-plan snapshot.
-- Mapping candidates are NOT approved mandatory OCR fields and never authorize substitution.
CREATE TABLE IF NOT EXISTS case_requirement_field_plans (
  consultation_run_id text NOT NULL,
  requirement_id text NOT NULL,
  case_id text NOT NULL REFERENCES cases(id),
  document_type_id text NOT NULL REFERENCES shared_document_types(id),
  catalog_sha256 text NOT NULL,
  schema_version text NOT NULL,
  routing_status text NOT NULL,
  mapping_status text NOT NULL,
  plan_json text NOT NULL,
  plan_sha256 text NOT NULL,
  created_at text NOT NULL,
  PRIMARY KEY (consultation_run_id, requirement_id),
  FOREIGN KEY (consultation_run_id, requirement_id) REFERENCES case_document_requirements(consultation_run_id, requirement_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_requirement_field_plans_case_idx
  ON case_requirement_field_plans(case_id, consultation_run_id, document_type_id);
