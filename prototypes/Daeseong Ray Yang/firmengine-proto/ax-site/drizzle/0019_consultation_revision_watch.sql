-- P0/F02: appendConsultation increments revision and clears active_run_id.
-- The previous trigger missed changes while active_run_id was already NULL.
DROP TRIGGER IF EXISTS case_watch_consultation_heads_update;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_consultation_heads_update AFTER UPDATE ON consultation_heads
WHEN OLD.revision IS NEW.revision AND
 (OLD.active_run_id IS NOT NEW.active_run_id OR OLD.case_id IS NOT NEW.case_id)
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.case_id,'consultation_heads',NEW.case_id,'UPDATE',
 CASE WHEN NEW.active_run_id IS NULL THEN 'requirements_deactivated' ELSE 'requirements_activated' END,
 (SELECT revision FROM cases WHERE id=NEW.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS case_watch_consultation_heads_revision_change
AFTER UPDATE OF revision ON consultation_heads
WHEN OLD.revision IS NOT NEW.revision
BEGIN
 INSERT INTO case_data_change_events(case_id,table_name,row_id,operation,event_kind,case_revision,changed_at)
 VALUES(NEW.case_id,'consultation_heads',NEW.case_id,'UPDATE','consultation_changed',
 (SELECT revision FROM cases WHERE id=NEW.case_id),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_data_change_state_due_idx ON case_data_change_state(last_changed_at,case_id);
