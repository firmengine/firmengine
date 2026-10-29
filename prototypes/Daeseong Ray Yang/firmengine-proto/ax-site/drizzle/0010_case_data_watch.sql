-- Append-only source-data change detection. No automatic calculation, review or acknowledgement.
CREATE TABLE IF NOT EXISTS case_data_change_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
 case_id TEXT NOT NULL, table_name TEXT NOT NULL, row_id TEXT NOT NULL,
 operation TEXT NOT NULL, event_kind TEXT NOT NULL, case_revision INTEGER,
 changed_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_data_change_events_case_cursor_idx ON case_data_change_events(case_id,id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS case_data_change_state (
 case_id TEXT PRIMARY KEY NOT NULL, data_version INTEGER NOT NULL,
 last_event_id INTEGER NOT NULL, last_case_revision INTEGER, last_changed_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_data_change_events_update_state AFTER INSERT ON case_data_change_events
BEGIN
 INSERT INTO case_data_change_state(case_id,data_version,last_event_id,last_case_revision,last_changed_at)
 VALUES(NEW.case_id,1,NEW.id,NEW.case_revision,NEW.changed_at)
 ON CONFLICT(case_id) DO UPDATE SET data_version=case_data_change_state.data_version+1,
 last_event_id=excluded.last_event_id,last_case_revision=excluded.last_case_revision,last_changed_at=excluded.last_changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_cases_insert AFTER INSERT ON cases
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.id,'cases',NEW.id,'INSERT','case_created',NEW.revision,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_cases_update AFTER UPDATE ON cases
WHEN (OLD.revision IS NOT NEW.revision)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.id,'cases',NEW.id,'UPDATE','case_data_changed',NEW.revision,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_documents_insert AFTER INSERT ON documents
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.case_id,'documents',NEW.id,'INSERT','document_added',(SELECT revision FROM cases WHERE id=NEW.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_documents_update AFTER UPDATE ON documents
WHEN (OLD.id IS NOT NEW.id OR OLD.case_id IS NOT NEW.case_id OR OLD.name IS NOT NEW.name OR OLD.sha256 IS NOT NEW.sha256 OR OLD.page_count IS NOT NEW.page_count OR OLD.original_key IS NOT NEW.original_key OR OLD.ready IS NOT NEW.ready)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.case_id,'documents',NEW.id,'UPDATE','document_changed',(SELECT revision FROM cases WHERE id=NEW.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_documents_move_old AFTER UPDATE ON documents
WHEN OLD.case_id IS NOT NEW.case_id
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(OLD.case_id,'documents',OLD.id,'UPDATE','document_removed',(SELECT revision FROM cases WHERE id=OLD.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_documents_delete AFTER DELETE ON documents
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(OLD.case_id,'documents',OLD.id,'DELETE','document_removed',(SELECT revision FROM cases WHERE id=OLD.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_consultation_heads_insert AFTER INSERT ON consultation_heads
WHEN NEW.active_run_id IS NOT NULL
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.case_id,'consultation_heads',NEW.case_id,'INSERT','requirements_activated',(SELECT revision FROM cases WHERE id=NEW.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_consultation_heads_update AFTER UPDATE ON consultation_heads
WHEN (OLD.active_run_id IS NOT NEW.active_run_id OR OLD.case_id IS NOT NEW.case_id)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.case_id,'consultation_heads',NEW.case_id,'UPDATE','requirements_activated',(SELECT revision FROM cases WHERE id=NEW.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_consultation_heads_move_old AFTER UPDATE ON consultation_heads
WHEN OLD.active_run_id IS NOT NULL AND OLD.case_id IS NOT NEW.case_id
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(OLD.case_id,'consultation_heads',OLD.case_id,'UPDATE','requirements_deactivated',(SELECT revision FROM cases WHERE id=OLD.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_consultation_heads_delete AFTER DELETE ON consultation_heads
WHEN OLD.active_run_id IS NOT NULL
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(OLD.case_id,'consultation_heads',OLD.case_id,'DELETE','requirements_deactivated',(SELECT revision FROM cases WHERE id=OLD.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_requirements_insert AFTER INSERT ON case_document_requirements
WHEN EXISTS(SELECT 1 FROM consultation_heads c WHERE c.case_id=NEW.case_id AND c.active_run_id=NEW.consultation_run_id)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.case_id,'case_document_requirements',NEW.consultation_run_id||':'||NEW.requirement_id,'INSERT','requirement_changed',(SELECT revision FROM cases WHERE id=NEW.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_requirements_update AFTER UPDATE ON case_document_requirements
WHEN EXISTS(SELECT 1 FROM consultation_heads c WHERE c.case_id=NEW.case_id AND c.active_run_id=NEW.consultation_run_id) AND (OLD.consultation_run_id IS NOT NEW.consultation_run_id OR OLD.requirement_id IS NOT NEW.requirement_id OR OLD.case_id IS NOT NEW.case_id OR OLD.document_type_id IS NOT NEW.document_type_id OR OLD.document_name IS NOT NEW.document_name OR OLD.subject_id IS NOT NEW.subject_id OR OLD.subject_label IS NOT NEW.subject_label OR OLD.required_period IS NOT NEW.required_period OR OLD.requirement IS NOT NEW.requirement OR OLD.status IS NOT NEW.status OR OLD.catalog_version IS NOT NEW.catalog_version OR OLD.catalog_sha256 IS NOT NEW.catalog_sha256 OR OLD.raw_json IS NOT NEW.raw_json OR OLD.raw_sha256 IS NOT NEW.raw_sha256)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.case_id,'case_document_requirements',NEW.consultation_run_id||':'||NEW.requirement_id,'UPDATE','requirement_changed',(SELECT revision FROM cases WHERE id=NEW.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_requirements_move_old AFTER UPDATE ON case_document_requirements
WHEN EXISTS(SELECT 1 FROM consultation_heads c WHERE c.case_id=OLD.case_id AND c.active_run_id=OLD.consultation_run_id) AND (OLD.case_id IS NOT NEW.case_id OR OLD.consultation_run_id IS NOT NEW.consultation_run_id)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(OLD.case_id,'case_document_requirements',OLD.consultation_run_id||':'||OLD.requirement_id,'UPDATE','requirement_removed',(SELECT revision FROM cases WHERE id=OLD.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_requirements_delete AFTER DELETE ON case_document_requirements
WHEN EXISTS(SELECT 1 FROM consultation_heads c WHERE c.case_id=OLD.case_id AND c.active_run_id=OLD.consultation_run_id)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(OLD.case_id,'case_document_requirements',OLD.consultation_run_id||':'||OLD.requirement_id,'DELETE','requirement_removed',(SELECT revision FROM cases WHERE id=OLD.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_extraction_heads_insert AFTER INSERT ON case_extraction_heads
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.case_id,'case_extraction_heads',NEW.source_document_id||':'||CAST(NEW.page AS TEXT),'INSERT','extraction_activated',(SELECT revision FROM cases WHERE id=NEW.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_extraction_heads_update AFTER UPDATE ON case_extraction_heads
WHEN (OLD.case_id IS NOT NEW.case_id OR OLD.source_document_id IS NOT NEW.source_document_id OR OLD.page IS NOT NEW.page OR OLD.run_id IS NOT NEW.run_id)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.case_id,'case_extraction_heads',NEW.source_document_id||':'||CAST(NEW.page AS TEXT),'UPDATE','extraction_activated',(SELECT revision FROM cases WHERE id=NEW.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_extraction_heads_move_old AFTER UPDATE ON case_extraction_heads
WHEN (OLD.case_id IS NOT NEW.case_id OR OLD.source_document_id IS NOT NEW.source_document_id OR OLD.page IS NOT NEW.page)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(OLD.case_id,'case_extraction_heads',OLD.source_document_id||':'||CAST(OLD.page AS TEXT),'UPDATE','extraction_deactivated',(SELECT revision FROM cases WHERE id=OLD.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_extraction_heads_delete AFTER DELETE ON case_extraction_heads
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(OLD.case_id,'case_extraction_heads',OLD.source_document_id||':'||CAST(OLD.page AS TEXT),'DELETE','extraction_deactivated',(SELECT revision FROM cases WHERE id=OLD.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_records_insert AFTER INSERT ON extraction_records
WHEN EXISTS(SELECT 1 FROM case_extraction_heads h WHERE h.run_id=NEW.run_id)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES((SELECT h.case_id FROM case_extraction_heads h WHERE h.run_id=NEW.run_id LIMIT 1),'extraction_records',NEW.id,'INSERT','extraction_record_changed',(SELECT revision FROM cases WHERE id=(SELECT h.case_id FROM case_extraction_heads h WHERE h.run_id=NEW.run_id LIMIT 1)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_records_update AFTER UPDATE ON extraction_records
WHEN EXISTS(SELECT 1 FROM case_extraction_heads h WHERE h.run_id=NEW.run_id) AND (OLD.id IS NOT NEW.id OR OLD.run_id IS NOT NEW.run_id OR OLD.ordinal IS NOT NEW.ordinal OR OLD.category IS NOT NEW.category OR OLD.label IS NOT NEW.label)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES((SELECT h.case_id FROM case_extraction_heads h WHERE h.run_id=NEW.run_id LIMIT 1),'extraction_records',NEW.id,'UPDATE','extraction_record_changed',(SELECT revision FROM cases WHERE id=(SELECT h.case_id FROM case_extraction_heads h WHERE h.run_id=NEW.run_id LIMIT 1)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_records_move_old AFTER UPDATE ON extraction_records
WHEN EXISTS(SELECT 1 FROM case_extraction_heads h WHERE h.run_id=OLD.run_id) AND OLD.run_id IS NOT NEW.run_id
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES((SELECT h.case_id FROM case_extraction_heads h WHERE h.run_id=OLD.run_id LIMIT 1),'extraction_records',OLD.id,'UPDATE','extraction_record_removed',(SELECT revision FROM cases WHERE id=(SELECT h.case_id FROM case_extraction_heads h WHERE h.run_id=OLD.run_id LIMIT 1)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_records_delete AFTER DELETE ON extraction_records
WHEN EXISTS(SELECT 1 FROM case_extraction_heads h WHERE h.run_id=OLD.run_id)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES((SELECT h.case_id FROM case_extraction_heads h WHERE h.run_id=OLD.run_id LIMIT 1),'extraction_records',OLD.id,'DELETE','extraction_record_removed',(SELECT revision FROM cases WHERE id=(SELECT h.case_id FROM case_extraction_heads h WHERE h.run_id=OLD.run_id LIMIT 1)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_features_insert AFTER INSERT ON extracted_features
WHEN EXISTS(SELECT 1 FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=NEW.record_id)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES((SELECT h.case_id FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=NEW.record_id LIMIT 1),'extracted_features',NEW.id,'INSERT','extracted_feature_changed',(SELECT revision FROM cases WHERE id=(SELECT h.case_id FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=NEW.record_id LIMIT 1)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_features_update AFTER UPDATE ON extracted_features
WHEN EXISTS(SELECT 1 FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=NEW.record_id) AND (OLD.id IS NOT NEW.id OR OLD.record_id IS NOT NEW.record_id OR OLD.schema_id IS NOT NEW.schema_id OR OLD.ordinal IS NOT NEW.ordinal OR OLD.canonical_field_id IS NOT NEW.canonical_field_id OR OLD.field_key IS NOT NEW.field_key OR OLD.label IS NOT NEW.label OR OLD.raw_value_json IS NOT NEW.raw_value_json OR OLD.unit IS NOT NEW.unit OR OLD.source_state IS NOT NEW.source_state OR OLD.confidence IS NOT NEW.confidence OR OLD.quote IS NOT NEW.quote OR OLD.bbox_json IS NOT NEW.bbox_json OR OLD.raw_field_json IS NOT NEW.raw_field_json OR OLD.binding_status IS NOT NEW.binding_status OR OLD.validation_status IS NOT NEW.validation_status OR OLD.validation_json IS NOT NEW.validation_json)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES((SELECT h.case_id FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=NEW.record_id LIMIT 1),'extracted_features',NEW.id,'UPDATE','extracted_feature_changed',(SELECT revision FROM cases WHERE id=(SELECT h.case_id FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=NEW.record_id LIMIT 1)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_features_move_old AFTER UPDATE ON extracted_features
WHEN EXISTS(SELECT 1 FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=OLD.record_id) AND OLD.record_id IS NOT NEW.record_id
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES((SELECT h.case_id FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=OLD.record_id LIMIT 1),'extracted_features',OLD.id,'UPDATE','extracted_feature_removed',(SELECT revision FROM cases WHERE id=(SELECT h.case_id FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=OLD.record_id LIMIT 1)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_features_delete AFTER DELETE ON extracted_features
WHEN EXISTS(SELECT 1 FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=OLD.record_id)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES((SELECT h.case_id FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=OLD.record_id LIMIT 1),'extracted_features',OLD.id,'DELETE','extracted_feature_removed',(SELECT revision FROM cases WHERE id=(SELECT h.case_id FROM extraction_records r JOIN case_extraction_heads h ON h.run_id=r.run_id WHERE r.id=OLD.record_id LIMIT 1)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
-- Existing cases receive one explicit baseline. Reapplying this migration cannot reset a cursor/version.
INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
SELECT c.id,'cases',c.id,'BASELINE','baseline',c.revision,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM cases c
WHERE NOT EXISTS(SELECT 1 FROM case_data_change_state s WHERE s.case_id=c.id);
