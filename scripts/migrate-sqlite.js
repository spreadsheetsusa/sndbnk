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

// Catalog cutover + idempotent seeds (safe on every deploy).
const GIB = 1024 * 1024 * 1024;
const now = Date.now();

// Retire Basic / Premium / Business; remap any leftover profile plan ids to Free.
sqlite.exec(`DELETE FROM plan WHERE id IN ('basic', 'premium', 'business')`);
sqlite.exec(`
UPDATE profile SET plan = 'free'
WHERE plan NOT IN ('free', 'vault', 'studio', 'label')
`);

const seedPlan = sqlite.prepare(`
INSERT OR IGNORE INTO plan (
	id, label, blurb, features, max_tracks, max_local_bytes,
	allow_storage_adapters, allow_subdomain, allow_custom_domain,
	allow_remove_branding, max_team_seats,
	monthly_amount, yearly_amount, currency, sort_order, active,
	created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'usd', ?, true, ?, ?)
`);

/**
 * @type {Array<[
 *   string, string, string, string[],
 *   number | null, number | null,
 *   boolean, boolean, boolean, boolean, number,
 *   number, number, number
 * ]>}
 */
const seeds = [
	[
		'free',
		'Free',
		'Fully usable forever — especially with your own storage.',
		[
			'Public profile at sndbnk.com/users/you',
			'1 GB hosted storage',
			'Bring your own storage (SSH now; S3 / R2 soon)',
			'Unlimited tracks'
		],
		null,
		1 * GIB,
		true,
		false,
		false,
		false,
		0,
		0,
		0,
		0
	],
	[
		'vault',
		'Vault',
		'Your own subdomain on sndbnk.com.',
		[
			'Everything in Free',
			'30 GB hosted storage',
			'Subdomain at you.sndbnk.com',
			'Bring your own storage'
		],
		null,
		30 * GIB,
		true,
		true,
		false,
		false,
		0,
		500,
		4800,
		1
	],
	[
		'studio',
		'Studio',
		'Your own domain. Your own design. Full power.',
		[
			'Everything in Vault',
			'150 GB hosted storage',
			'Custom domain via CNAME',
			'Remove SNDBNK branding',
			'Bring your own storage'
		],
		null,
		150 * GIB,
		true,
		true,
		true,
		true,
		0,
		1400,
		13400,
		2
	],
	[
		'label',
		'Label',
		'Teams and scale for serious catalogs.',
		[
			'Everything in Studio',
			'500 GB hosted storage',
			'Teams (coming soon) — 5 seats',
			'Bring your own storage'
		],
		null,
		500 * GIB,
		true,
		true,
		true,
		true,
		5,
		3500,
		33600,
		3
	]
];

// One-shot entitlement matrix when cutting over a DB that still lacks `free`.
// INSERT OR IGNORE alone would leave a half-migrated catalog untouched; REPLACE
// only when the new free tier is missing so later admin edits survive redeploys.
const hasFree = sqlite.query(`SELECT 1 AS ok FROM plan WHERE id = 'free' LIMIT 1`).get();
if (!hasFree) {
	const replacePlan = sqlite.prepare(`
INSERT OR REPLACE INTO plan (
	id, label, blurb, features, max_tracks, max_local_bytes,
	allow_storage_adapters, allow_subdomain, allow_custom_domain,
	allow_remove_branding, max_team_seats,
	monthly_amount, yearly_amount, currency, sort_order, active,
	created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'usd', ?, true, ?, ?)
`);
	for (const row of seeds) {
		replacePlan.run(
			row[0],
			row[1],
			row[2],
			JSON.stringify(row[3]),
			row[4],
			row[5],
			row[6],
			row[7],
			row[8],
			row[9],
			row[10],
			row[11],
			row[12],
			row[13],
			now,
			now
		);
	}
} else {
	for (const row of seeds) {
		seedPlan.run(
			row[0],
			row[1],
			row[2],
			JSON.stringify(row[3]),
			row[4],
			row[5],
			row[6],
			row[7],
			row[8],
			row[9],
			row[10],
			row[11],
			row[12],
			row[13],
			now,
			now
		);
	}
}

// Admin-comped paid accounts without a Stripe subscription stay entitled.
sqlite.exec(`
UPDATE profile SET subscription_status = 'grandfathered'
WHERE plan <> 'free' AND stripe_subscription_id IS NULL AND subscription_status IS NULL
`);

// Singleton play-threshold knobs; INSERT OR IGNORE so admin edits survive redeploys.
sqlite
	.prepare(
		`
INSERT OR IGNORE INTO platform_settings (
	id, track_play_percent, mix_play_continual_ms, updated_at
) VALUES ('default', 60, 600000, ?)
`
	)
	.run(now);

const tables = sqlite
	.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
	.all()
	.map((row) => row.name);

console.log(`Migrations applied to ${dbPath}`);
console.log(`Tables: ${tables.join(', ') || '(none)'}`);
sqlite.close();
