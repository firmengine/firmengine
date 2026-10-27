CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`revision` integer NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analyses_case_idx` ON `analyses` (`case_id`);--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`revision` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`object_key` text NOT NULL,
	`hash` text NOT NULL,
	`mime` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `artifacts_case_idx` ON `artifacts` (`case_id`);--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner` text NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`name` text NOT NULL,
	`sha256` text NOT NULL,
	`page_count` integer NOT NULL,
	`original_key` text,
	`ready` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documents_case_idx` ON `documents` (`case_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`actor` text NOT NULL,
	`type` text NOT NULL,
	`detail` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_case_idx` ON `events` (`case_id`);--> statement-breakpoint
CREATE TABLE `page_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`document_id` text NOT NULL,
	`page` integer NOT NULL,
	`role` text NOT NULL,
	`document_type` text,
	`image_key` text,
	`image_hash` text,
	`status` text NOT NULL,
	`stage` text DEFAULT 'waiting' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`lease_until` text,
	`cache_key` text,
	`result` text,
	`error` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `page_jobs_case_idx` ON `page_jobs` (`case_id`);