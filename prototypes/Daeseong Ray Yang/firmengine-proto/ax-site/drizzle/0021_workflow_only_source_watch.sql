-- An authenticated case review changes workflow/manifest metadata, not original
-- evidence. Preserve the last real source change and 10-minute due window.
-- Writers may briefly set mutation_category to review_only/artifact_only only
-- inside an atomic D1 batch after a strict before/after source comparison.
ALTER TABLE cases ADD COLUMN mutation_category TEXT NOT NULL DEFAULT 'source'
  CHECK (mutation_category IN ('source','review_only','artifact_only'));
--> statement-breakpoint
DROP TRIGGER IF EXISTS case_watch_cases_update;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_cases_update AFTER UPDATE ON cases
WHEN OLD.revision IS NOT NEW.revision AND NEW.mutation_category='source'
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.id,'cases',NEW.id,'UPDATE','case_data_changed',NEW.revision,
 strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS case_watch_cases_direct_payload_update;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_cases_direct_payload_update AFTER UPDATE OF payload,storage_token ON cases
WHEN OLD.revision IS NEW.revision AND NEW.mutation_category='source'
 AND (OLD.payload IS NOT NEW.payload OR OLD.storage_token IS NOT NEW.storage_token)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.id,'cases',NEW.id,'UPDATE','case_payload_changed_without_revision',NEW.revision,
 strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
