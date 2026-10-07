ALTER TABLE `track` ADD `download_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `track` ADD `can_download` integer DEFAULT true NOT NULL;