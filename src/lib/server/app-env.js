/**
 * Process-env config for modules that also run outside SvelteKit (BullMQ worker).
 * Bun auto-loads `.env`; systemd sets `EnvironmentFile`. Kit still validates the
 * declared set via `$app/env/private` imports elsewhere at app boot (`src/env.js`).
 */

/** @param {string} key */
function required(key) {
	const value = process.env[key]?.trim();
	if (!value) throw new Error(`${key} is not set`);
	return value;
}

/** @param {string} key */
function optional(key) {
	const value = process.env[key]?.trim();
	return value ? value : undefined;
}

export const DATABASE_URL = required('DATABASE_URL');
export const MEDIA_ROOT = required('MEDIA_ROOT');
export const STORAGE_SECRET = required('STORAGE_SECRET');
export const REDIS_URL = optional('REDIS_URL');
