CREATE TABLE `shared_document_types` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `category` text NOT NULL,
  `issuer` text NOT NULL,
  `purpose` text NOT NULL,
  `collection_mode` text NOT NULL,
  `routing_status` text NOT NULL,
  `catalog_version` integer NOT NULL REFERENCES `intake_catalog_versions`(`version`),
  `catalog_sha256` text NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `payload_json` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shared_document_types_active_idx` ON `shared_document_types` (`active`,`catalog_sha256`);
--> statement-breakpoint
CREATE TABLE `shared_document_type_versions` (
  `catalog_sha256` text NOT NULL,
  `document_type_id` text NOT NULL REFERENCES `shared_document_types`(`id`),
  `catalog_version` integer NOT NULL REFERENCES `intake_catalog_versions`(`version`),
  `name` text NOT NULL,
  `category` text NOT NULL,
  `issuer` text NOT NULL,
  `purpose` text NOT NULL,
  `collection_mode` text NOT NULL,
  `routing_status` text NOT NULL,
  `payload_json` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY (`catalog_sha256`,`document_type_id`)
);
--> statement-breakpoint
CREATE INDEX `shared_document_type_versions_type_idx` ON `shared_document_type_versions` (`document_type_id`,`catalog_version`);
--> statement-breakpoint
CREATE TABLE `case_document_requirements` (
  `consultation_run_id` text NOT NULL REFERENCES `consultation_runs`(`id`),
  `requirement_id` text NOT NULL,
  `case_id` text NOT NULL REFERENCES `cases`(`id`),
  `document_type_id` text NOT NULL REFERENCES `shared_document_types`(`id`),
  `document_name` text NOT NULL,
  `subject_id` text NOT NULL,
  `subject_label` text NOT NULL,
  `required_period` text NOT NULL,
  `requirement` text NOT NULL,
  `status` text NOT NULL,
  `catalog_version` integer NOT NULL REFERENCES `intake_catalog_versions`(`version`),
  `catalog_sha256` text NOT NULL,
  `raw_json` text NOT NULL,
  `raw_sha256` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY (`consultation_run_id`,`requirement_id`),
  FOREIGN KEY (`catalog_sha256`,`document_type_id`) REFERENCES `shared_document_type_versions`(`catalog_sha256`,`document_type_id`)
);
--> statement-breakpoint
CREATE INDEX `case_document_requirements_case_idx` ON `case_document_requirements` (`case_id`,`consultation_run_id`,`status`);
--> statement-breakpoint
CREATE INDEX `case_document_requirements_type_idx` ON `case_document_requirements` (`document_type_id`,`case_id`);
