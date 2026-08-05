import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

import { DATABASE_URL } from '#lib/server/app-env.js';
import * as schema from './schema';

const sqlite = new Database(DATABASE_URL);
sqlite.exec('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
