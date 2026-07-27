import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { MEDIA_ROOT } from '$app/env/private';

/**
 * @param {string} userId
 * @param {string} folderKey
 */
function folderPath(userId, folderKey) {
	return path.join(MEDIA_ROOT, userId, folderKey);
}

/**
 * @param {string} userId
 * @returns {import('./types.js').StorageAdapter}
 */
export function createLocalAdapter(userId) {
	return {
		id: 'local',

		async put(folderKey, filename, data, _contentType) {
			const dir = folderPath(userId, folderKey);
			await mkdir(dir, { recursive: true });
			const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
			await Bun.write(path.join(dir, filename), bytes);
		},

		async get(folderKey, filename) {
			const filePath = path.join(folderPath(userId, folderKey), filename);
			const file = Bun.file(filePath);
			if (!(await file.exists())) {
				throw new Error('File not found.');
			}
			return {
				body: file,
				contentType: file.type || 'application/octet-stream',
				size: file.size
			};
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
