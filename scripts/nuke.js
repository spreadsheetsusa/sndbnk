/**
 * Reset local (or early-prod) state to a fresh, production-ready empty app:
 * delete the SQLite database (+ sidecars), wipe MEDIA_ROOT, wipe DB backups,
 * then re-run migrations + seeds.
 *
 * Interactive:
 *   bun run nuke
 *   → type `nuke` to confirm
 *
 * Non-interactive (still explicit):
 *   NUKE_CONFIRM=nuke bun run nuke
 *
 * Production-shaped hosts (ORIGIN hostname is not localhost/127.0.0.1, or the
 * DB path lives under /var/www/) need a second phrase:
 *   type `reset production` interactively, or set NUKE_PRODUCTION=reset production
 */
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const CONFIRM_WORD = 'nuke';
const PROD_CONFIRM_PHRASE = 'reset production';

const dbPathRaw = process.env.DATABASE_URL?.trim();
const mediaRootRaw = process.env.MEDIA_ROOT?.trim();
if (!dbPathRaw) die('DATABASE_URL is not set.');
if (!mediaRootRaw) die('MEDIA_ROOT is not set.');

const cwd = process.cwd();
const dbPath = resolve(cwd, dbPathRaw);
const mediaRoot = resolve(cwd, mediaRootRaw);
const backupDir = resolve(process.env.BACKUP_DIR?.trim() || join(dirname(dbPath), 'backups'));
const origin = process.env.ORIGIN?.trim() || '';
const productionShaped = isProductionShaped({ origin, dbPath });

const dbSidecars = [`${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`];
const targets = [
	{ label: 'SQLite database', path: dbPath, kind: 'file' },
	...dbSidecars.map((path) => ({ label: 'SQLite sidecar', path, kind: 'file' })),
	{ label: 'Media root', path: mediaRoot, kind: 'dir' },
	{ label: 'DB backups', path: backupDir, kind: 'dir' }
];

console.log(`
sndbnk nuke — wipe app data and re-initialize a fresh database
`);
console.log(`DATABASE_URL   ${dbPathRaw}  →  ${dbPath}`);
console.log(`MEDIA_ROOT     ${mediaRootRaw}  →  ${mediaRoot}`);
console.log(`BACKUP_DIR     ${backupDir}`);
if (origin) console.log(`ORIGIN         ${origin}`);
if (productionShaped) {
	console.log(`
⚠  This looks production-shaped (non-local ORIGIN and/or /var/www/ DB path).
   A second confirmation is required.
`);
}

console.log('Will remove (if present):');
for (const target of targets) {
	const present = existsSync(target.path) ? 'present' : 'missing';
	console.log(`  - ${target.label}: ${target.path} (${present})`);
}
console.log(`
Then: bun run db:migrate  (fresh schema + plan seeds)
Does NOT touch .env, source, or drizzle/ migration files.
`);

await confirmOrDie();

console.log('Removing…');
for (const target of targets) {
	if (!existsSync(target.path)) continue;
	rmSync(target.path, { recursive: target.kind === 'dir', force: true });
	console.log(`  removed ${target.path}`);
}

mkdirSync(mediaRoot, { recursive: true });
console.log(`  ensured empty media root ${mediaRoot}`);

console.log('\nRe-initializing database…');
const migrate = spawnSync('bun', ['run', 'db:migrate'], {
	cwd,
	env: process.env,
	stdio: 'inherit'
});
if (migrate.status !== 0) {
	die(`db:migrate failed with exit ${migrate.status ?? 'unknown'}.`);
}

console.log(`
Nuke complete. App data is empty; schema + plan seeds are applied.
Next (optional): bun run createsuperuser
`);

/**
 * @param {{ origin: string, dbPath: string }} input
 * @returns {boolean}
 */
function isProductionShaped({ origin, dbPath }) {
	if (dbPath === '/var/www' || dbPath.startsWith('/var/www/')) return true;
	if (!origin) return false;
	try {
		const host = new URL(origin).hostname.toLowerCase();
		if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
		if (host.endsWith('.localhost')) return false;
		return true;
	} catch {
		return false;
	}
}

async function confirmOrDie() {
	const envConfirm = process.env.NUKE_CONFIRM?.trim();
	const envProd = process.env.NUKE_PRODUCTION?.trim();

	if (envConfirm !== undefined && envConfirm !== '') {
		if (envConfirm !== CONFIRM_WORD) {
			die(`NUKE_CONFIRM must be exactly "${CONFIRM_WORD}" (got ${JSON.stringify(envConfirm)}).`);
		}
		if (productionShaped && envProd !== PROD_CONFIRM_PHRASE) {
			die(
				`Production-shaped reset also needs NUKE_PRODUCTION="${PROD_CONFIRM_PHRASE}" when using env confirm.`
			);
		}
		console.log('Confirmed via NUKE_CONFIRM env.');
		return;
	}

	if (!process.stdin.isTTY) {
		die(
			`Non-interactive shell: set NUKE_CONFIRM=${CONFIRM_WORD}` +
				(productionShaped ? ` NUKE_PRODUCTION="${PROD_CONFIRM_PHRASE}"` : '') +
				' to proceed.'
		);
	}

	const typed = (await ask(`Type "${CONFIRM_WORD}" to continue: `)).trim();
	if (typed !== CONFIRM_WORD) die('Aborted — confirmation did not match.');

	if (productionShaped) {
		const prodTyped = (
			await ask(`Type "${PROD_CONFIRM_PHRASE}" to reset production-shaped data: `)
		).trim();
		if (prodTyped !== PROD_CONFIRM_PHRASE) {
			die('Aborted — production confirmation did not match.');
		}
	}
}

/**
 * @param {string} question
 * @returns {Promise<string>}
 */
function ask(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolveAsk) => {
		rl.question(question, (answer) => {
			rl.close();
			resolveAsk(answer);
		});
	});
}

/**
 * @param {string} message
 * @returns {never}
 */
function die(message) {
	console.error(message);
	process.exit(1);
}
