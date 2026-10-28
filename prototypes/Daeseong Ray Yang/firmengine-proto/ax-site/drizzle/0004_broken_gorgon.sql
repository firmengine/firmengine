CREATE TABLE `consultation_heads` (
	`case_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`active_run_id` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `consultation_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`text` text NOT NULL,
	`text_sha256` text NOT NULL,
	`occurred_at` text,
	`supersedes_id` text,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `consultation_notes_case_idx` ON `consultation_notes` (`case_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `consultation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`case_revision` integer NOT NULL,
	`case_storage_token` text NOT NULL,
	`consultation_revision` integer NOT NULL,
	`catalog_version` integer NOT NULL,
	`status` text NOT NULL,
	`lease_until` text,
	`payload` text,
	`error` text,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `consultation_runs_fingerprint_unique` ON `consultation_runs` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `consultation_runs_case_idx` ON `consultation_runs` (`case_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `intake_catalog_head` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`sha256` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `intake_catalog_versions` (
	`version` integer PRIMARY KEY NOT NULL,
	`schema_version` text NOT NULL,
	`payload` text NOT NULL,
	`sha256` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
