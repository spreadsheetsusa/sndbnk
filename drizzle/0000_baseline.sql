CREATE TABLE `follow` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`follower_id`, `following_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follow_followingId_idx` ON `follow` (`following_id`);--> statement-breakpoint
CREATE TABLE `plan` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`blurb` text DEFAULT '' NOT NULL,
	`features` text DEFAULT '[]' NOT NULL,
	`max_tracks` integer,
	`max_local_bytes` integer,
	`allow_storage_adapters` integer DEFAULT false NOT NULL,
	`allow_subdomain` integer DEFAULT false NOT NULL,
	`allow_custom_domain` integer DEFAULT false NOT NULL,
	`monthly_amount` integer DEFAULT 0 NOT NULL,
	`yearly_amount` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`stripe_product_id` text,
	`stripe_price_monthly_id` text,
	`stripe_price_yearly_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`plan` text DEFAULT 'basic' NOT NULL,
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
CREATE UNIQUE INDEX `profile_username_unique` ON `profile` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_custom_domain_unique` ON `profile` (`custom_domain`);--> statement-breakpoint
CREATE TABLE `profile_link` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profile_link_userId_idx` ON `profile_link` (`user_id`);--> statement-breakpoint
CREATE TABLE `storage_setting` (
	`user_id` text PRIMARY KEY NOT NULL,
	`adapter` text DEFAULT 'local' NOT NULL,
	`ssh_host` text,
	`ssh_port` integer DEFAULT 22 NOT NULL,
	`ssh_username` text,
	`ssh_remote_path` text,
	`ssh_private_key_enc` text,
	`ssh_passphrase_enc` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stripe_event` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `track` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`artist` text,
	`album` text,
	`genre` text,
	`year` integer,
	`track_number` integer,
	`bpm` integer,
	`isrc` text,
	`comment` text,
	`audio_filename` text NOT NULL,
	`audio_mime` text NOT NULL,
	`audio_bytes` integer NOT NULL,
	`cover_filename` text,
	`cover_mime` text,
	`cover_bytes` integer,
	`duration_ms` integer,
	`bitrate` integer,
	`sample_rate` integer,
	`channels` integer,
	`codec` text,
	`waveform` text,
	`published` integer DEFAULT true NOT NULL,
	`storage_adapter` text DEFAULT 'local' NOT NULL,
	`folder_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `track_createdAt_id_idx` ON `track` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `track_userId_createdAt_idx` ON `track` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `track_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`track_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`at_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `track`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `track_comment_trackId_idx` ON `track_comment` (`track_id`);--> statement-breakpoint
CREATE TABLE `track_like` (
	`track_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`track_id`, `user_id`),
	FOREIGN KEY (`track_id`) REFERENCES `track`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `track_repost` (
	`track_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`track_id`, `user_id`),
	FOREIGN KEY (`track_id`) REFERENCES `track`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `track_repost_userId_createdAt_idx` ON `track_repost` (`user_id`,`created_at`,`track_id`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);