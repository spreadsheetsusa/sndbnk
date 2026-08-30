ALTER TABLE `track` ADD `slug` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `track` SET `slug` = `id` WHERE `slug` = '';--> statement-breakpoint
CREATE UNIQUE INDEX `track_userId_slug_uidx` ON `track` (`user_id`,`slug`);