CREATE TABLE `site_page` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`parent_id` text,
	`slug` text DEFAULT '' NOT NULL,
	`path` text NOT NULL,
	`title` text DEFAULT 'Home' NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `site_page`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_page_site_path_uidx` ON `site_page` (`site_id`,`path`);--> statement-breakpoint
CREATE INDEX `site_page_site_id_idx` ON `site_page` (`site_id`);