import path from 'node:path';

import { MEDIA_ROOT } from '#lib/server/app-env';

import { assertSafeStoragePath, assertSafeStorageSegment } from './path-safety.js';

/**
 * Absolute filesystem path for a local-adapter track object.
 * @param {string} userId
 * @param {string} folderKey
 * @param {string} filename
 */
export function localTrackFilePath(userId, folderKey, filename) {
	assertSafeStorageSegment(filename, 'filename');
	return path.join(assertSafeStoragePath(MEDIA_ROOT, userId, folderKey), filename);
}
