-- Source OCR fields keep raw keys; derived typed projection keys have an explicit version.
ALTER TABLE extracted_features ADD COLUMN projection_key TEXT;
--> statement-breakpoint
ALTER TABLE extracted_features ADD COLUMN binding_version TEXT NOT NULL DEFAULT 'legacy';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS extraction_field_coverage (
  run_id TEXT NOT NULL REFERENCES extraction_runs(id),
  schema_id TEXT NOT NULL REFERENCES extraction_schema_versions(id),
  canonical_field_id TEXT NOT NULL,
  observation_status TEXT NOT NULL CHECK(observation_status IN ('not_observed_on_page','observed_review_required','observed_source_only')),
  observed_count INTEGER NOT NULL CHECK(observed_count >= 0),
  review_count INTEGER NOT NULL CHECK(review_count >= 0),
  source_state_counts_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(run_id,canonical_field_id),
  FOREIGN KEY(schema_id,canonical_field_id) REFERENCES extraction_schema_fields(schema_id,canonical_field_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS extraction_field_coverage_status_idx ON extraction_field_coverage(schema_id,observation_status);
