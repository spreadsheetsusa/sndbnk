UPDATE plan
SET
	max_tracks = 15,
	max_local_bytes = NULL,
	features = '["Public profile at sndbnk.com/users/you","15 tracks","Bring your own storage (SSH now; S3 / R2 soon)"]',
	updated_at = (CAST(unixepoch('subsecond') * 1000 AS INTEGER))
WHERE id = 'free';
--> statement-breakpoint
UPDATE plan
SET
	features = '["Everything in Free","Unlimited tracks","30 GB hosted storage","Subdomain at you.sndbnk.com","Bring your own storage"]',
	updated_at = (CAST(unixepoch('subsecond') * 1000 AS INTEGER))
WHERE id = 'vault';
