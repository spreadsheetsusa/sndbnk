ALTER TABLE `site` ADD `sidebar_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `site` ADD `sidebar_stats` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `site` ADD `sidebar_fans_also_like` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `site` ADD `sidebar_followers` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `site` ADD `sidebar_activity` integer DEFAULT true NOT NULL;