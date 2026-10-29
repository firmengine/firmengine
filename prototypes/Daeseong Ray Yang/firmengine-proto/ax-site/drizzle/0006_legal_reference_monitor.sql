CREATE TABLE IF NOT EXISTS legal_reference_releases (
  id TEXT PRIMARY KEY NOT NULL, revision INTEGER NOT NULL, seed_sha256 TEXT NOT NULL,
  sha256 TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL,
  created_at TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legal_reference_items (
  release_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, category TEXT NOT NULL,
  title TEXT NOT NULL, sha256 TEXT NOT NULL, payload TEXT NOT NULL,
  PRIMARY KEY (release_id,id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_reference_items_kind_idx ON legal_reference_items(release_id,kind);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legal_reference_changes (
  id TEXT PRIMARY KEY NOT NULL, reference_id TEXT NOT NULL, status TEXT NOT NULL,
  base_sha256 TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, actor TEXT NOT NULL,
  reviewed_at TEXT, reviewed_by TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legal_monitor_observations (
  source_id TEXT PRIMARY KEY NOT NULL, sha256 TEXT NOT NULL, payload TEXT NOT NULL, fetched_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legal_monitor_runs (
  id TEXT PRIMARY KEY NOT NULL, agent TEXT NOT NULL, status TEXT NOT NULL,
  started_at TEXT NOT NULL, completed_at TEXT, payload TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legal_monitor_alerts (
  id TEXT PRIMARY KEY NOT NULL, agent TEXT NOT NULL, source_id TEXT NOT NULL,
  status TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
  acknowledged_at TEXT, acknowledged_by TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_monitor_alerts_created_idx ON legal_monitor_alerts(created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legal_monitor_state (
  id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legal_monitor_locks (
  id TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL, expires_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legal_monitor_observation_history (
  source_id TEXT NOT NULL, sha256 TEXT NOT NULL, payload TEXT NOT NULL, fetched_at TEXT NOT NULL,
  PRIMARY KEY (source_id,sha256)
);
