import { drizzle } from 'drizzle-orm/bun-sqlite';

import { DATABASE_URL } from '#lib/server/app-env';
import * as schema from './schema';

export const db = drizzle(DATABASE_URL, { schema });
