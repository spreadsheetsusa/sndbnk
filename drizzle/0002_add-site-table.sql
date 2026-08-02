CREATE TABLE `site` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text,
	`description` text,
	`logo_filename` text,
	`logo_mime` text,
	`accent_color` text,
	`hide_branding` integer DEFAULT false NOT NULL,
	`og_image_filename` text,
	`og_image_mime` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
