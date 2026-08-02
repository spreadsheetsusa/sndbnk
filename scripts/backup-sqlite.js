/**
 * Copy the SQLite database (and WAL/SHM sidecars if present) to a timestamped backup.
 *
 * Usage:
 *   DATABASE_URL=local.db bun ./scripts/backup-sqlite.js
 *   DATABASE_URL=/var/www/sndbnk/local.db BACKUP_DIR=/var/www/sndbnk/backups bun ./scripts/backup-sqlite.js
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

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
copyFileSync(dbPath, dest);
console.log(`Backed up ${dbPath} → ${dest}`);

for (const suffix of ['-wal', '-shm', '-journal']) {
	const side = `${dbPath}${suffix}`;
	if (!existsSync(side)) continue;
	const sideDest = `${dest}${suffix}`;
	copyFileSync(side, sideDest);
	console.log(`Backed up ${side} → ${sideDest}`);
}
