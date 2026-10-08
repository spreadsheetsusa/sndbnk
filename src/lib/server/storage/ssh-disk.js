import { eq } from 'drizzle-orm';

import { db } from '#lib/server/db/index.js';
import { storageSetting } from '#lib/server/db/schema.js';
import { decryptSecret } from './crypto.js';
import { statSshVolume } from './ssh.js';

/** Reuse a reading across library loads. Disk fill does not move per click. */
const FRESH_MS = 10 * 60 * 1000;
/** A down host should not open a new session on every navigation. */
const FAILURE_MS = 60 * 1000;
/** Don't hold the library render on a slow handshake. The probe keeps running. */
const WAIT_MS = 4000;

/**
 * @typedef {{
 *   fingerprint: string,
 *   ok: boolean,
 *   usedBytes: number,
 *   totalBytes: number,
 *   freshUntil: number,
 *   retryAfter: number
 * }} DiskCacheEntry
 */

/** @type {Map<string, DiskCacheEntry>} */
const cache = new Map();

/** @type {Map<string, Promise<{ usedBytes: number, totalBytes: number } | null>>} */
const inflight = new Map();

/**
 * @param {typeof storageSetting.$inferSelect} row
 */
function fingerprintOf(row) {
	return `${row.sshHost ?? ''}\0${row.sshPort ?? 22}\0${row.sshRemotePath ?? ''}`;
}

/**
 * @param {typeof storageSetting.$inferSelect} row
 * @returns {import('./ssh.js').SshConfig | null}
 */
function configFromRow(row) {
	if (!row.sshHost || !row.sshUsername || !row.sshRemotePath || !row.sshPrivateKeyEnc) return null;
	try {
		return {
			host: row.sshHost,
			port: row.sshPort ?? 22,
			username: row.sshUsername,
			remotePath: row.sshRemotePath,
			privateKey: decryptSecret(row.sshPrivateKeyEnc),
			passphrase: row.sshPassphraseEnc ? decryptSecret(row.sshPassphraseEnc) : null
		};
	} catch {
		return null;
	}
}

/**
 * @param {string} userId
 * @param {NonNullable<ReturnType<typeof configFromRow>>} config
 * @param {string} fingerprint
 * @returns {Promise<{ usedBytes: number, totalBytes: number } | null>}
 */
function refresh(userId, config, fingerprint) {
	const pending = inflight.get(userId);
	if (pending) return pending;

	const job = statSshVolume(config)
		.then((volume) => {
			const now = Date.now();
			cache.set(userId, {
				fingerprint,
				ok: true,
				usedBytes: volume.usedBytes,
				totalBytes: volume.totalBytes,
				freshUntil: now + FRESH_MS,
				retryAfter: now + FRESH_MS
			});
			return volume;
		})
		.catch(() => {
			const prev = cache.get(userId);
			const retryAfter = Date.now() + FAILURE_MS;
			if (prev?.ok && prev.fingerprint === fingerprint) {
				cache.set(userId, { ...prev, freshUntil: 0, retryAfter });
				return { usedBytes: prev.usedBytes, totalBytes: prev.totalBytes };
			}
			cache.set(userId, {
				fingerprint,
				ok: false,
				usedBytes: 0,
				totalBytes: 0,
				freshUntil: 0,
				retryAfter
			});
			return null;
		})
		.finally(() => {
			inflight.delete(userId);
		});

	inflight.set(userId, job);
	return job;
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T | 'timeout'>}
 */
function withTimeout(promise, ms) {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve('timeout'), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			() => {
				clearTimeout(timer);
				resolve('timeout');
			}
		);
	});
}

/**
 * Filesystem used/total for an SSH library, or null when this account is not
 * on SSH or the probe has nothing to show yet.
 *
 * @param {string} userId
 * @returns {Promise<{ usedBytes: number, totalBytes: number } | null>}
 */
export async function getCachedSshDiskUsage(userId) {
	const rows = await db
		.select()
		.from(storageSetting)
		.where(eq(storageSetting.userId, userId))
		.limit(1);
	const row = rows[0];
	if (!row || row.adapter !== 'ssh') return null;

	const fingerprint = fingerprintOf(row);
	const hit = cache.get(userId);
	const same = hit?.fingerprint === fingerprint;
	const now = Date.now();

	if (same && hit.ok && now < hit.freshUntil) {
		return { usedBytes: hit.usedBytes, totalBytes: hit.totalBytes };
	}

	if (same && now < hit.retryAfter) {
		return hit.ok ? { usedBytes: hit.usedBytes, totalBytes: hit.totalBytes } : null;
	}

	const config = configFromRow(row);
	if (!config) return null;

	if (same && hit.ok) {
		refresh(userId, config, fingerprint);
		return { usedBytes: hit.usedBytes, totalBytes: hit.totalBytes };
	}

	const result = await withTimeout(refresh(userId, config, fingerprint), WAIT_MS);
	if (result === 'timeout') return null;
	return result;
}
