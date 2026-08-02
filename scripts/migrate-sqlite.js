/**
 * Apply Drizzle SQL migrations with Bun's native SQLite driver.
 *
 * drizzle-kit's `migrate` CLI loads better-sqlite3 (Node-only). This script uses
 * `drizzle-orm/bun-sqlite/migrator` so deploy and local apply stay on Bun.
 *
 * Existing databases created by the old push script are baselined: if app tables
 * already exist and `__drizzle_migrations` is empty, the baseline migration is
 * recorded as applied without re-running its CREATE TABLE statements.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

const dbPath = process.env.DATABASE_URL;
if (!dbPath) throw new Error('DATABASE_URL is not set');

const migrationsFolder = join(import.meta.dir, '..', 'drizzle');
const journalPath = join(migrationsFolder, 'meta', '_journal.json');
const migrationsTable = '__drizzle_migrations';

if (!existsSync(journalPath)) {
	throw new Error(`Missing ${journalPath}. Run \`bun run db:generate\` first.`);
}

const sqlite = new Database(dbPath, { create: true });
sqlite.exec('PRAGMA foreign_keys = ON;');

/**
 * @returns {boolean}
 */
function hasAppTables() {
	const row = sqlite
		.query("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'user' LIMIT 1")
		.get();
	return Boolean(row);
}

/**
 * @returns {number}
 */
function migrationRowCount() {
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS ${migrationsTable} (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			hash text NOT NULL,
			created_at numeric
		)
	`);
	const row = sqlite.query(`SELECT COUNT(*) AS n FROM ${migrationsTable}`).get();
	return Number(row?.n ?? 0);
}

/**
 * Mark only the baseline migration as applied without executing its SQL.
 * Used once when cutting over a pre-Drizzle database that already matches schema.
 * Later journal entries still run through `migrate()`.
 */
function baselineExistingDatabase() {
	const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
	const entry = journal.entries.find((item) => item.tag === '0000_baseline') ?? journal.entries[0];
	if (!entry) throw new Error('Drizzle journal has no migrations to baseline.');

	const sqlPath = join(migrationsFolder, `${entry.tag}.sql`);
	const query = readFileSync(sqlPath, 'utf8');
	const hash = createHash('sha256').update(query).digest('hex');

	sqlite
		.prepare(`INSERT INTO ${migrationsTable} ("hash", "created_at") VALUES (?, ?)`)
		.run(hash, entry.when);
	console.log(`Baselined migration ${entry.tag}`);
}

if (migrationRowCount() === 0 && hasAppTables()) {
	console.log('Existing database detected with no Drizzle journal — baselining.');
	baselineExistingDatabase();
}

const db = drizzle(sqlite);
migrate(db, { migrationsFolder, migrationsTable });

// Idempotent seeds that are not schema DDL (safe on every deploy).
const GIB = 1024 * 1024 * 1024;
const now = Date.now();
const seedPlan = sqlite.prepare(`
INSERT OR IGNORE INTO plan (
	id, label, blurb, features, max_tracks, max_local_bytes,
	allow_storage_adapters, allow_subdomain, allow_custom_domain,
	monthly_amount, yearly_amount, currency, sort_order, active,
	created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'usd', ?, true, ?, ?)
`);

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
sqlite.exec(`
UPDATE profile SET subscription_status = 'grandfathered'
WHERE plan <> 'basic' AND stripe_subscription_id IS NULL AND subscription_status IS NULL
`);

const tables = sqlite
	.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
	.all()
	.map((row) => row.name);

console.log(`Migrations applied to ${dbPath}`);
console.log(`Tables: ${tables.join(', ') || '(none)'}`);
sqlite.close();
