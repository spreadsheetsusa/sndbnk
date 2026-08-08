CREATE TABLE `account_link` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`accepted_at` integer,
	FOREIGN KEY (`requester_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_link_requester_recipient_uidx` ON `account_link` (`requester_id`,`recipient_id`);--> statement-breakpoint
CREATE INDEX `account_link_recipientId_idx` ON `account_link` (`recipient_id`);--> statement-breakpoint
CREATE INDEX `account_link_requesterId_idx` ON `account_link` (`requester_id`);