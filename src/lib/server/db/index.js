import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

import { DATABASE_URL } from '#lib/server/app-env.js';
import { SQLITE_PRAGMAS } from './pragmas.js';
import * as schema from './schema';

const sqlite = new Database(DATABASE_URL);
sqlite.exec(SQLITE_PRAGMAS);

export const db = drizzle(sqlite, { schema });

/** Cheap liveness probe for `/api/health`. */
export function pingDatabase() {
	sqlite.query('SELECT 1').get();
}
