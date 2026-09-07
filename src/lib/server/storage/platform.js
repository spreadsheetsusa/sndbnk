import { isMissingStorageObject } from './errors.js';
import { createLocalAdapter } from './local.js';
import { createS3Adapter } from './s3.js';
import { isPlatformS3Configured, platformAdapterId } from './s3-config.js';

/**
 * Snapshot values stored on `track.storageAdapter`.
 *
 * @param {string | null | undefined} value
 * @returns {import('./types.js').StorageAdapterKind}
 */
export function parseStoredAdapter(value) {
	if (value === 'ssh' || value === 's3' || value === 'r2') return value;
	return 'local';
}

/**
 * Platform-hosted adapters (SNDBNK disk or S3). SSH BYOS is excluded from quota.
 *
 * @param {string | null | undefined} value
 */
export function isHostedStorageAdapter(value) {
	return value === 'local' || value === 's3';
}

/**
 * Adapter for new SNDBNK-hosted writes (avatars, site images, default tracks).
 * @param {string} userId
 * @returns {import('./types.js').StorageAdapter}
 */
export function createPlatformAdapter(userId) {
	return platformAdapterId() === 's3' ? createS3Adapter(userId) : createLocalAdapter(userId);
}

/**
 * Read a platform object. When S3 is configured, try S3 first and fall back to
 * local so unmigrated avatars / site assets keep serving during the lift.
 *
 * @param {string} userId
 * @param {string} folderKey
 * @param {string} filename
 * @param {import('./types.js').StorageByteRange} [range]
 */
export async function getPlatformObject(userId, folderKey, filename, range) {
	if (!isPlatformS3Configured()) {
		return createLocalAdapter(userId).get(folderKey, filename, range);
	}

	try {
		return await createS3Adapter(userId).get(folderKey, filename, range);
	} catch (err) {
		if (!isMissingStorageObject(err)) throw err;
		return createLocalAdapter(userId).get(folderKey, filename, range);
	}
}

/**
 * Delete a platform folder from S3 (when configured) and local, so a replace
 * cannot fall back to a stale local copy.
 *
 * @param {string} userId
 * @param {string} folderKey
 */
export async function deletePlatformFolder(userId, folderKey) {
	if (isPlatformS3Configured()) {
		try {
			await createS3Adapter(userId).delete(folderKey);
		} catch {
			// Still clear the local leftover.
		}
	}
	await createLocalAdapter(userId).delete(folderKey);
}
