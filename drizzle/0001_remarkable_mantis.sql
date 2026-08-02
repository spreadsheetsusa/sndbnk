PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`bio` text,
	`location` text,
	`avatar_filename` text,
	`avatar_mime` text,
	`custom_domain` text,
	`custom_domain_status` text DEFAULT 'none' NOT NULL,
	`domain_verify_token` text,
	`custom_domain_verified_at` integer,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`plan_interval` text,
	`subscription_status` text,
	`current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_profile`("user_id", "username", "plan", "bio", "location", "avatar_filename", "avatar_mime", "custom_domain", "custom_domain_status", "domain_verify_token", "custom_domain_verified_at", "stripe_customer_id", "stripe_subscription_id", "plan_interval", "subscription_status", "current_period_end", "cancel_at_period_end", "created_at", "updated_at") SELECT "user_id", "username", "plan", "bio", "location", "avatar_filename", "avatar_mime", "custom_domain", "custom_domain_status", "domain_verify_token", "custom_domain_verified_at", "stripe_customer_id", "stripe_subscription_id", "plan_interval", "subscription_status", "current_period_end", "cancel_at_period_end", "created_at", "updated_at" FROM `profile`;--> statement-breakpoint
DROP TABLE `profile`;--> statement-breakpoint
ALTER TABLE `__new_profile` RENAME TO `profile`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `profile_username_unique` ON `profile` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_custom_domain_unique` ON `profile` (`custom_domain`);--> statement-breakpoint
ALTER TABLE `plan` ADD `allow_remove_branding` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `plan` ADD `max_team_seats` integer DEFAULT 0 NOT NULL;