-- Track exact canonical projection edits and raw case-payload rewrites.
-- A source edit invalidates prior calculation and legal AI data versions.
DROP TRIGGER IF EXISTS case_watch_features_update;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_features_update AFTER UPDATE ON extracted_features
WHEN EXISTS(SELECT 1 FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=NEW.record_id)
AND (
 OLD.id IS NOT NEW.id OR OLD.record_id IS NOT NEW.record_id OR OLD.schema_id IS NOT NEW.schema_id
 OR OLD.ordinal IS NOT NEW.ordinal OR OLD.canonical_field_id IS NOT NEW.canonical_field_id
 OR OLD.field_key IS NOT NEW.field_key OR OLD.label IS NOT NEW.label
 OR OLD.raw_value_json IS NOT NEW.raw_value_json OR OLD.unit IS NOT NEW.unit
 OR OLD.source_state IS NOT NEW.source_state OR OLD.confidence IS NOT NEW.confidence
 OR OLD.quote IS NOT NEW.quote OR OLD.bbox_json IS NOT NEW.bbox_json
 OR OLD.raw_field_json IS NOT NEW.raw_field_json OR OLD.binding_status IS NOT NEW.binding_status
 OR OLD.validation_status IS NOT NEW.validation_status OR OLD.validation_json IS NOT NEW.validation_json
 OR OLD.projection_key IS NOT NEW.projection_key OR OLD.binding_version IS NOT NEW.binding_version
)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES((SELECT h.case_id FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=NEW.record_id LIMIT 1),
 'extracted_features',NEW.id,'UPDATE','extracted_feature_changed',
 (SELECT revision FROM cases WHERE id=(SELECT h.case_id FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=NEW.record_id LIMIT 1)),
 strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_cases_direct_payload_update AFTER UPDATE OF payload,storage_token ON cases
WHEN OLD.revision IS NEW.revision AND (OLD.payload IS NOT NEW.payload OR OLD.storage_token IS NOT NEW.storage_token)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.id,'cases',NEW.id,'UPDATE','case_payload_changed_without_revision',NEW.revision,
 strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
