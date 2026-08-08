import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { MEDIA_ROOT } from '#lib/server/app-env.js';

import { assertSafeStoragePath, assertSafeStorageSegment } from './path-safety.js';

/**
 * @param {string} userId
 * @param {string} folderKey
 */
function folderPath(userId, folderKey) {
	assertSafeStorageSegment(userId, 'user id');
	assertSafeStorageSegment(folderKey, 'folder key');
	return assertSafeStoragePath(MEDIA_ROOT, userId, folderKey);
}

/**
 * Wipe every local media folder for a user (tracks, avatar, site assets, orphans).
 * @param {string} userId
 */
export async function wipeUserLocalMedia(userId) {
	assertSafeStorageSegment(userId, 'user id');
	const dir = assertSafeStoragePath(MEDIA_ROOT, userId);
	await rm(dir, { recursive: true, force: true });
}

/**
 * @param {string} userId
 * @returns {import('./types.js').StorageAdapter}
 */
export function createLocalAdapter(userId) {
	assertSafeStorageSegment(userId, 'user id');

	return {
		id: 'local',

		async put(folderKey, filename, data, _contentType) {
			assertSafeStorageSegment(filename, 'filename');
			const dir = folderPath(userId, folderKey);
			await mkdir(dir, { recursive: true });
			const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
			await Bun.write(path.join(dir, filename), bytes);
		},

		async get(folderKey, filename, range) {
			assertSafeStorageSegment(filename, 'filename');
			const filePath = path.join(folderPath(userId, folderKey), filename);
			const file = Bun.file(filePath);
			if (!(await file.exists())) {
				throw new Error('File not found.');
			}
			const size = file.size;
			const contentType = file.type || 'application/octet-stream';
			if (!range) {
				return { body: file, contentType, size };
			}
			const start = Math.max(0, range.start);
			const end = Math.min(range.end ?? size - 1, size - 1);
			if (size <= 0 || start > end) {
				return { body: file.slice(0, 0), contentType, size };
			}
			// Bun.file slices are lazy — disk seek, not a full read.
			return { body: file.slice(start, end + 1), contentType, size };
		},

		async delete(folderKey) {
			const dir = folderPath(userId, folderKey);
			await rm(dir, { recursive: true, force: true });
		},

		async testConnection() {
			try {
				await mkdir(MEDIA_ROOT, { recursive: true });
				await readdir(MEDIA_ROOT);
				return { ok: true };
			} catch (err) {
				return {
					ok: false,
					message: err instanceof Error ? err.message : 'Local media root is not writable.'
				};
			}
		}
	};
}
