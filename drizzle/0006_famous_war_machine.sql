CREATE TABLE `listen_history` (
	`user_id` text NOT NULL,
	`track_id` text NOT NULL,
	`last_played_at` integer NOT NULL,
	`play_count` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`user_id`, `track_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `track`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `listen_history_userId_lastPlayedAt_idx` ON `listen_history` (`user_id`,`last_played_at`,`track_id`);--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`track_play_percent` integer DEFAULT 60 NOT NULL,
	`mix_play_continual_ms` integer DEFAULT 600000 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `track` ADD `play_count` integer DEFAULT 0 NOT NULL;