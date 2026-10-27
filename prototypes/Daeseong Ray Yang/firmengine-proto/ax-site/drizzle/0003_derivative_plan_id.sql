ALTER TABLE `page_derivatives` ADD COLUMN `plan_id` text NOT NULL DEFAULT 'legacy';
--> statement-breakpoint
CREATE INDEX `page_derivatives_plan_idx` ON `page_derivatives` (`case_id`,`document_id`,`page`,`plan_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_derivatives_plan_variant_uq` ON `page_derivatives` (`case_id`,`document_id`,`page`,`plan_id`,`variant`) WHERE `plan_id` <> 'legacy';
