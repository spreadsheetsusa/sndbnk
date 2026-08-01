/**
 * Apply the SQLite schema using Bun's native driver.
 * drizzle-kit's push path loads better-sqlite3, which Bun cannot open.
 *
 * Existing DBs are upgraded with idempotent ALTER TABLE ADD COLUMN —
 * CREATE TABLE IF NOT EXISTS alone does not add new columns.
 */
import { Database } from 'bun:sqlite';

const dbPath = process.env.DATABASE_URL;
if (!dbPath) {
	throw new Error('DATABASE_URL is not set');
}

const db = new Database(dbPath, { create: true });
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS task (
	id text PRIMARY KEY NOT NULL,
	title text NOT NULL,
	priority integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS user (
	id text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	email text NOT NULL,
	email_verified integer DEFAULT false NOT NULL,
	image text,
	created_at integer NOT NULL,
	updated_at integer NOT NULL,
	role text,
	banned integer DEFAULT false,
	ban_reason text,
	ban_expires integer
);
CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique ON user (email);

CREATE TABLE IF NOT EXISTS session (
	id text PRIMARY KEY NOT NULL,
	expires_at integer NOT NULL,
	token text NOT NULL,
	created_at integer NOT NULL,
	updated_at integer NOT NULL,
	ip_address text,
	user_agent text,
	user_id text NOT NULL,
	impersonated_by text,
	FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS session_token_unique ON session (token);
CREATE INDEX IF NOT EXISTS session_userId_idx ON session (user_id);

CREATE TABLE IF NOT EXISTS account (
	id text PRIMARY KEY NOT NULL,
	account_id text NOT NULL,
	provider_id text NOT NULL,
	user_id text NOT NULL,
	access_token text,
	refresh_token text,
	id_token text,
	access_token_expires_at integer,
	refresh_token_expires_at integer,
	scope text,
	password text,
	created_at integer NOT NULL,
	updated_at integer NOT NULL,
	FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS account_userId_idx ON account (user_id);

CREATE TABLE IF NOT EXISTS verification (
	id text PRIMARY KEY NOT NULL,
	identifier text NOT NULL,
	value text NOT NULL,
	expires_at integer NOT NULL,
	created_at integer NOT NULL,
	updated_at integer NOT NULL
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification (identifier);

CREATE TABLE IF NOT EXISTS plan (
	id text PRIMARY KEY NOT NULL,
	label text NOT NULL,
	blurb text DEFAULT '' NOT NULL,
	features text DEFAULT '[]' NOT NULL,
	max_tracks integer,
	max_local_bytes integer,
	allow_storage_adapters integer DEFAULT false NOT NULL,
	allow_subdomain integer DEFAULT false NOT NULL,
	allow_custom_domain integer DEFAULT false NOT NULL,
	monthly_amount integer DEFAULT 0 NOT NULL,
	yearly_amount integer DEFAULT 0 NOT NULL,
	currency text DEFAULT 'usd' NOT NULL,
	stripe_product_id text,
	stripe_price_monthly_id text,
	stripe_price_yearly_id text,
	sort_order integer DEFAULT 0 NOT NULL,
	active integer DEFAULT true NOT NULL,
	created_at integer NOT NULL,
	updated_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS stripe_event (
	id text PRIMARY KEY NOT NULL,
	type text NOT NULL,
	received_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS profile (
	user_id text PRIMARY KEY NOT NULL,
	username text NOT NULL,
	plan text DEFAULT 'basic' NOT NULL,
	bio text,
	location text,
	avatar_filename text,
	avatar_mime text,
	custom_domain text,
	custom_domain_status text DEFAULT 'none' NOT NULL,
	domain_verify_token text,
	custom_domain_verified_at integer,
	stripe_customer_id text,
	stripe_subscription_id text,
	plan_interval text,
	subscription_status text,
	current_period_end integer,
	cancel_at_period_end integer DEFAULT false NOT NULL,
	created_at integer NOT NULL,
	updated_at integer NOT NULL,
	FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS profile_username_unique ON profile (username);
CREATE UNIQUE INDEX IF NOT EXISTS profile_custom_domain_unique ON profile (custom_domain);

CREATE TABLE IF NOT EXISTS profile_link (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL,
	label text NOT NULL,
	url text NOT NULL,
	position integer DEFAULT 0 NOT NULL,
	created_at integer NOT NULL,
	FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS profile_link_userId_idx ON profile_link (user_id);

CREATE TABLE IF NOT EXISTS storage_setting (
	user_id text PRIMARY KEY NOT NULL,
	adapter text DEFAULT 'local' NOT NULL,
	ssh_host text,
	ssh_port integer DEFAULT 22 NOT NULL,
	ssh_username text,
	ssh_remote_path text,
	ssh_private_key_enc text,
	ssh_passphrase_enc text,
	updated_at integer NOT NULL,
	FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS track (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL,
	title text NOT NULL,
	description text,
	artist text,
	album text,
	genre text,
	year integer,
	track_number integer,
	bpm integer,
	isrc text,
	comment text,
	audio_filename text NOT NULL,
	audio_mime text NOT NULL,
	audio_bytes integer NOT NULL,
	cover_filename text,
	cover_mime text,
	cover_bytes integer,
	duration_ms integer,
	bitrate integer,
	sample_rate integer,
	channels integer,
	codec text,
	waveform text,
	published integer DEFAULT 1 NOT NULL,
	storage_adapter text DEFAULT 'local' NOT NULL,
	folder_key text NOT NULL,
	created_at integer NOT NULL,
	updated_at integer NOT NULL,
	FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS track_userId_idx ON track (user_id);
-- Keyset pagination walks (created_at, id); these must match that order or every
-- page after the first degrades into a scan.
CREATE INDEX IF NOT EXISTS track_createdAt_id_idx ON track (created_at, id);
CREATE INDEX IF NOT EXISTS track_userId_createdAt_idx ON track (user_id, created_at, id);

CREATE TABLE IF NOT EXISTS track_comment (
	id text PRIMARY KEY NOT NULL,
	track_id text NOT NULL,
	user_id text NOT NULL,
	body text NOT NULL,
	at_ms integer,
	created_at integer NOT NULL,
	FOREIGN KEY (track_id) REFERENCES track(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS track_comment_trackId_idx ON track_comment (track_id);

CREATE TABLE IF NOT EXISTS track_like (
	track_id text NOT NULL,
	user_id text NOT NULL,
	created_at integer NOT NULL,
	PRIMARY KEY (track_id, user_id),
	FOREIGN KEY (track_id) REFERENCES track(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS track_repost (
	track_id text NOT NULL,
	user_id text NOT NULL,
	created_at integer NOT NULL,
	PRIMARY KEY (track_id, user_id),
	FOREIGN KEY (track_id) REFERENCES track(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS track_repost_userId_createdAt_idx ON track_repost (user_id, created_at, track_id);

CREATE TABLE IF NOT EXISTS follow (
	follower_id text NOT NULL,
	following_id text NOT NULL,
	created_at integer NOT NULL,
	PRIMARY KEY (follower_id, following_id),
	FOREIGN KEY (follower_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (following_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS follow_followingId_idx ON follow (following_id);
`);

/**
 * Add missing columns on existing tables. SQLite CREATE TABLE IF NOT EXISTS
 * never alters an already-created table.
 * @param {string} table
 * @param {Array<[string, string]>} columns column name + SQL type fragment
 */
function ensureColumns(table, columns) {
	const existing = new Set(
		db
			.query(`SELECT name FROM pragma_table_info('${table}')`)
			.all()
			.map((row) => row.name)
	);

	for (const [name, typeSql] of columns) {
		if (existing.has(name)) continue;
		db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${typeSql}`);
		console.log(`Added column ${table}.${name}`);
	}
}

ensureColumns('user', [
	['role', 'text'],
	['banned', 'integer DEFAULT false'],
	['ban_reason', 'text'],
	['ban_expires', 'integer']
]);

ensureColumns('session', [['impersonated_by', 'text']]);

ensureColumns('profile', [
	['bio', 'text'],
	['location', 'text'],
	['avatar_filename', 'text'],
	['avatar_mime', 'text'],
	['plan_interval', 'text'],
	['subscription_status', 'text'],
	['current_period_end', 'integer'],
	['cancel_at_period_end', 'integer NOT NULL DEFAULT false']
]);

ensureColumns('track', [
	['duration_ms', 'integer'],
	['bitrate', 'integer'],
	['sample_rate', 'integer'],
	['channels', 'integer'],
	['codec', 'text'],
	['waveform', 'text'],
	['published', 'integer NOT NULL DEFAULT 1']
]);

// Seed the tiers. INSERT OR IGNORE so re-running never clobbers admin panel edits.
// Stripe price ids stay null here; `bun run stripe:bootstrap` fills them per environment.
const GIB = 1024 * 1024 * 1024;

const seedPlan = db.prepare(`
INSERT OR IGNORE INTO plan (
	id, label, blurb, features, max_tracks, max_local_bytes,
	allow_storage_adapters, allow_subdomain, allow_custom_domain,
	monthly_amount, yearly_amount, currency, sort_order, active,
	created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'usd', ?, true, ?, ?)
`);

const now = Date.now();

/** @type {Array<[string, string, string, string[], number | null, number | null, boolean, boolean, boolean, number, number, number]>} */
const seeds = [
	[
		'basic',
		'Basic',
		'A public profile on SNDBNK, free forever.',
		['Public profile at sndbnk.com/users/you', 'Up to 10 tracks', 'Hosted storage'],
		10,
		null,
		false,
		false,
		false,
		0,
		0,
		0
	],
	[
		'premium',
		'Premium',
		'Your own subdomain, your own storage.',
		[
			'Everything in Basic',
			'Up to 100 tracks',
			'Subdomain at you.sndbnk.com',
			'Custom domain via CNAME',
			'Bring your own storage'
		],
		100,
		null,
		true,
		true,
		true,
		500,
		4900,
		1
	],
	[
		'business',
		'Business',
		'Unlimited tracks on your own domain.',
		[
			'Everything in Premium',
			'Unlimited tracks',
			'25 GB of hosted storage',
			'Map your own TLD to your profile'
		],
		null,
		25 * GIB,
		true,
		true,
		true,
		1000,
		9800,
		2
	]
];

for (const [
	id,
	label,
	blurb,
	features,
	maxTracks,
	maxLocalBytes,
	adapters,
	subdomain,
	customDomain,
	monthly,
	yearly,
	sortOrder
] of seeds) {
	seedPlan.run(
		id,
		label,
		blurb,
		JSON.stringify(features),
		maxTracks,
		maxLocalBytes,
		adapters,
		subdomain,
		customDomain,
		monthly,
		yearly,
		sortOrder,
		now,
		now
	);
}

// Accounts that got premium from the pre-billing plan toggle keep it without a subscription.
db.exec(`
UPDATE profile SET subscription_status = 'grandfathered'
WHERE plan <> 'basic' AND stripe_subscription_id IS NULL AND subscription_status IS NULL
`);

const tables = db
	.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
	.all()
	.map((row) => row.name);

console.log(`Schema applied to ${dbPath}`);
console.log(`Tables: ${tables.join(', ') || '(none)'}`);
db.close();
