import IORedis from 'ioredis';

import { REDIS_URL } from '#lib/server/app-env.js';

/**
 * @returns {string | undefined}
 */
export function getRedisUrl() {
	return REDIS_URL;
}

/**
 * BullMQ requires `maxRetriesPerRequest: null` on the ioredis connection.
 * @returns {import('ioredis').default | null}
 */
export function createRedisConnection() {
	const url = getRedisUrl();
	if (!url) return null;
	return new IORedis(url, { maxRetriesPerRequest: null });
}
