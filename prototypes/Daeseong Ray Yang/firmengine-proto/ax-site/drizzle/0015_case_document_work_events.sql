-- Append-only submission/OCR progress notifications; separate from
-- case_data_change_events so page processing does not invalidate calculations.
CREATE TABLE IF NOT EXISTS case_document_work_events (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  case_id text NOT NULL REFERENCES cases(id),
  event_kind text NOT NULL,
  source_id text NOT NULL,
  before_state text,
  after_state text,
  occurred_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS case_document_work_events_case_cursor_idx
  ON case_document_work_events(case_id,id);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS document_work_uploaded AFTER INSERT ON documents
BEGIN
 INSERT INTO case_document_work_events(case_id,event_kind,source_id,before_state,after_state,occurred_at)
 VALUES(NEW.case_id,'document_registered',NEW.id,NULL,CASE WHEN NEW.ready=1 THEN 'ready' ELSE 'awaiting_upload' END,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS document_work_ready AFTER UPDATE OF ready ON documents
WHEN OLD.ready IS NOT NEW.ready
BEGIN
 INSERT INTO case_document_work_events(case_id,event_kind,source_id,before_state,after_state,occurred_at)
 VALUES(NEW.case_id,'document_receipt_changed',NEW.id,CAST(OLD.ready AS text),CAST(NEW.ready AS text),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS document_work_deleted AFTER DELETE ON documents
BEGIN
 INSERT INTO case_document_work_events(case_id,event_kind,source_id,before_state,after_state,occurred_at)
 VALUES(OLD.case_id,'document_removed',OLD.id,'registered','removed',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS document_work_page_created AFTER INSERT ON page_jobs
BEGIN
 INSERT INTO case_document_work_events(case_id,event_kind,source_id,before_state,after_state,occurred_at)
 VALUES(NEW.case_id,'page_job_created',NEW.id,NULL,NEW.status||':'||NEW.stage,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS document_work_page_changed AFTER UPDATE OF status,stage,role,error ON page_jobs
WHEN OLD.status IS NOT NEW.status OR OLD.stage IS NOT NEW.stage OR OLD.role IS NOT NEW.role OR OLD.error IS NOT NEW.error
BEGIN
 INSERT INTO case_document_work_events(case_id,event_kind,source_id,before_state,after_state,occurred_at)
 VALUES(NEW.case_id,'page_job_changed',NEW.id,OLD.status||':'||OLD.stage,NEW.status||':'||NEW.stage,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS document_work_classified AFTER INSERT ON document_instances
BEGIN
 INSERT INTO case_document_work_events(case_id,event_kind,source_id,before_state,after_state,occurred_at)
 VALUES(NEW.case_id,'document_type_candidate',NEW.id,NULL,COALESCE(NEW.shared_document_type_id,'unclassified'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS document_work_extracted AFTER INSERT ON case_extraction_heads
BEGIN
 INSERT INTO case_document_work_events(case_id,event_kind,source_id,before_state,after_state,occurred_at)
 VALUES(NEW.case_id,'ocr_committed',NEW.source_document_id||':'||CAST(NEW.page AS text),NULL,NEW.run_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS document_work_reextracted AFTER UPDATE OF run_id ON case_extraction_heads
WHEN OLD.run_id IS NOT NEW.run_id
BEGIN
 INSERT INTO case_document_work_events(case_id,event_kind,source_id,before_state,after_state,occurred_at)
 VALUES(NEW.case_id,'ocr_replaced',NEW.source_document_id||':'||CAST(NEW.page AS text),OLD.run_id,NEW.run_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS document_work_extraction_removed AFTER DELETE ON case_extraction_heads
BEGIN
 INSERT INTO case_document_work_events(case_id,event_kind,source_id,before_state,after_state,occurred_at)
 VALUES(OLD.case_id,'ocr_retracted',OLD.source_document_id||':'||CAST(OLD.page AS text),OLD.run_id,NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
