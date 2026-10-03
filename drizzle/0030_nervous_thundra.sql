CREATE TABLE `site_listen` (
	`site_user_id` text NOT NULL,
	`listener_user_id` text NOT NULL,
	`track_id` text NOT NULL,
	`play_count` integer DEFAULT 1 NOT NULL,
	`last_played_at` integer NOT NULL,
	PRIMARY KEY(`site_user_id`, `listener_user_id`, `track_id`),
	FOREIGN KEY (`site_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listener_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `track`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `site_listen_site_last_idx` ON `site_listen` (`site_user_id`,`last_played_at`);--> statement-breakpoint
CREATE TABLE `site_stat_day` (
	`site_user_id` text NOT NULL,
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`key` text DEFAULT '' NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`plays` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`site_user_id`, `day`, `kind`, `key`),
	FOREIGN KEY (`site_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `site_stat_day_user_kind_day_idx` ON `site_stat_day` (`site_user_id`,`kind`,`day`);