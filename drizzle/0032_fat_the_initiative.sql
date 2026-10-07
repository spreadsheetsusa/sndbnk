CREATE TABLE `auth_handoff` (
	`id` text PRIMARY KEY NOT NULL,
	`dest_host` text NOT NULL,
	`return_url` text NOT NULL,
	`cookies_json` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_handoff_expires_idx` ON `auth_handoff` (`expires_at`);--> statement-breakpoint
CREATE TABLE `site_account` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`user_id` text NOT NULL,
	`hostname` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_account_site_user_uidx` ON `site_account` (`site_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `site_account_site_created_idx` ON `site_account` (`site_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `site` ADD `allow_domain_auth` integer DEFAULT false NOT NULL;