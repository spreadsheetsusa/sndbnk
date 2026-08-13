/**
 * Consistent SQLite snapshot via VACUUM INTO, then prune old backups.
 *
 * Usage:
 *   DATABASE_URL=local.db bun ./scripts/backup-sqlite.js
 *   DATABASE_URL=/var/www/sndbnk/local.db BACKUP_DIR=/var/www/sndbnk/backups bun ./scripts/backup-sqlite.js
 */
import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const KEEP = 14;

const dbPath = process.env.DATABASE_URL;
if (!dbPath) throw new Error('DATABASE_URL is not set');
if (!existsSync(dbPath)) throw new Error(`Database file not found: ${dbPath}`);

const stamp = new Date()
	.toISOString()
	.replaceAll(':', '-')
	.replace(/\.\d+Z$/, 'Z');
const backupDir = process.env.BACKUP_DIR ?? join(dirname(dbPath), 'backups');
mkdirSync(backupDir, { recursive: true });

const base = basename(dbPath);
const dest = join(backupDir, `${base}.${stamp}`);
const quoted = dest.replaceAll("'", "''");

const sqlite = new Database(dbPath);
try {
	sqlite.exec('PRAGMA busy_timeout = 5000;');
	sqlite.exec(`VACUUM INTO '${quoted}'`);
} finally {
	sqlite.close();
}
console.log(`Backed up ${dbPath} → ${dest}`);

const prefix = `${base}.`;
const backups = readdirSync(backupDir)
	.filter(
		(name) =>
			name.startsWith(prefix) &&
			!name.endsWith('-wal') &&
			!name.endsWith('-shm') &&
			!name.endsWith('-journal')
	)
	.sort();

const extra = backups.length - KEEP;
if (extra > 0) {
	for (const name of backups.slice(0, extra)) {
		const path = join(backupDir, name);
		unlinkSync(path);
		console.log(`Pruned old backup ${path}`);
	}
}
