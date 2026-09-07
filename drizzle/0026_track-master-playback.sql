ALTER TABLE `track` ADD `media_revision` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `track` ADD `master_filename` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `track` ADD `master_mime` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `track` ADD `master_bytes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `track` ADD `master_sha256` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `track` ADD `playback_filename` text;--> statement-breakpoint
ALTER TABLE `track` ADD `playback_mime` text;--> statement-breakpoint
ALTER TABLE `track` ADD `playback_bytes` integer;--> statement-breakpoint
ALTER TABLE `track` ADD `playback_status` text;--> statement-breakpoint
ALTER TABLE `track` ADD `playback_error` text;--> statement-breakpoint
ALTER TABLE `track` ADD `playback_updated_at` integer;--> statement-breakpoint
-- Backfill: original* present ⇒ master=original, playback=audio (ready derivative).
-- No original* ⇒ master=audio, playback null (alias or stream-master-if-sane).
-- Existing object keys are left as-is (no S3 re-key). media_revision is a fresh
-- race-guard id; master_sha256 stays empty until a later re-hash.
UPDATE `track` SET
	`media_revision` = lower(hex(randomblob(16))),
	`master_filename` = `original_filename`,
	`master_mime` = coalesce(`original_mime`, `audio_mime`),
	`master_bytes` = coalesce(`original_bytes`, `audio_bytes`),
	`playback_filename` = `audio_filename`,
	`playback_mime` = `audio_mime`,
	`playback_bytes` = `audio_bytes`,
	`playback_status` = 'ready',
	`playback_updated_at` = cast(strftime('%s', 'now') as integer) * 1000
WHERE `original_filename` IS NOT NULL AND trim(`original_filename`) != '';--> statement-breakpoint
UPDATE `track` SET
	`media_revision` = lower(hex(randomblob(16))),
	`master_filename` = `audio_filename`,
	`master_mime` = `audio_mime`,
	`master_bytes` = `audio_bytes`
WHERE `original_filename` IS NULL OR trim(`original_filename`) = '';