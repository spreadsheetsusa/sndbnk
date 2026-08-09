PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_site` (
	`user_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`name` text,
	`description` text,
	`logo_filename` text,
	`logo_mime` text,
	`accent_color` text,
	`hide_branding` integer DEFAULT false NOT NULL,
	`sidebar_enabled` integer DEFAULT false NOT NULL,
	`sidebar_stats` integer DEFAULT true NOT NULL,
	`sidebar_fans_also_like` integer DEFAULT true NOT NULL,
	`sidebar_followers` integer DEFAULT true NOT NULL,
	`sidebar_activity` integer DEFAULT true NOT NULL,
	`og_image_filename` text,
	`og_image_mime` text,
	`setup_completed_at` integer,
	`site_intent` text,
	`want_blog` integer DEFAULT false NOT NULL,
	`want_events` integer DEFAULT false NOT NULL,
	`want_ecommerce` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_site`(
	`user_id`,
	`id`,
	`name`,
	`description`,
	`logo_filename`,
	`logo_mime`,
	`accent_color`,
	`hide_branding`,
	`sidebar_enabled`,
	`sidebar_stats`,
	`sidebar_fans_also_like`,
	`sidebar_followers`,
	`sidebar_activity`,
	`og_image_filename`,
	`og_image_mime`,
	`setup_completed_at`,
	`site_intent`,
	`want_blog`,
	`want_events`,
	`want_ecommerce`,
	`created_at`,
	`updated_at`
)
SELECT
	`user_id`,
	lower(
		hex(randomblob(4)) || '-' ||
		hex(randomblob(2)) || '-' ||
		'4' || substr(hex(randomblob(2)), 2) || '-' ||
		substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' ||
		hex(randomblob(6))
	),
	`name`,
	`description`,
	`logo_filename`,
	`logo_mime`,
	`accent_color`,
	`hide_branding`,
	`sidebar_enabled`,
	`sidebar_stats`,
	`sidebar_fans_also_like`,
	`sidebar_followers`,
	`sidebar_activity`,
	`og_image_filename`,
	`og_image_mime`,
	NULL,
	NULL,
	false,
	false,
	false,
	`created_at`,
	`updated_at`
FROM `site`;--> statement-breakpoint
DROP TABLE `site`;--> statement-breakpoint
ALTER TABLE `__new_site` RENAME TO `site`;--> statement-breakpoint
CREATE UNIQUE INDEX `site_id_uidx` ON `site` (`id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
