CREATE TABLE `page_derivatives` (
 `id` text PRIMARY KEY NOT NULL, `case_id` text NOT NULL, `document_id` text NOT NULL,
 `page` integer NOT NULL, `source_hash` text NOT NULL, `base_image_hash` text NOT NULL,
 `variant_hash` text NOT NULL, `variant` text NOT NULL, `object_key` text NOT NULL,
 `bbox` text NOT NULL, `transform` text NOT NULL, `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `page_derivatives_page_idx` ON `page_derivatives` (`case_id`,`document_id`,`page`);
