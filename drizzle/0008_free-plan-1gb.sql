UPDATE plan
SET
	max_local_bytes = 1073741824,
	features = '["Public profile at sndbnk.com/users/you","1 GB hosted storage","Bring your own storage (SSH now; S3 / R2 soon)","Unlimited tracks"]',
	updated_at = (CAST(unixepoch('subsecond') * 1000 AS INTEGER))
WHERE id = 'free';
