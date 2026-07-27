import { error } from '@sveltejs/kit';

import { getOwnedTrack } from '#lib/server/tracks';
import { getStorageAdapter } from '#lib/server/storage';

/**
 * @param {string} kind
 * @param {typeof import('#lib/server/db/schema').track.$inferSelect} row
 */
function resolveFilename(kind, row) {
	if (kind === 'audio') return row.audioFilename;
	if (kind === 'cover') return row.coverFilename;
	return null;
}

/**
 * @param {string} kind
 * @param {typeof import('#lib/server/db/schema').track.$inferSelect} row
 */
function resolveMime(kind, row) {
	if (kind === 'audio') return row.audioMime;
	if (kind === 'cover') return row.coverMime ?? 'application/octet-stream';
	return 'application/octet-stream';
}

export async function GET({ locals, params }) {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const kind = params.file;
	if (kind !== 'audio' && kind !== 'cover') {
		error(404, 'Not found');
	}

	const row = await getOwnedTrack(locals.user.id, params.id);
	if (!row) {
		error(404, 'Not found');
	}

	const filename = resolveFilename(kind, row);
	if (!filename) {
		error(404, 'Not found');
	}

	try {
		const adapter = await getStorageAdapter(
			locals.user.id,
			/** @type {'local' | 'ssh'} */ (row.storageAdapter)
		);
		const object = await adapter.get(row.folderKey, filename);
		const mime = resolveMime(kind, row) || object.contentType;

		/** @type {BodyInit} */
		let body;
		if (object.body instanceof Uint8Array) {
			body = object.body;
		} else if (typeof Blob !== 'undefined' && object.body instanceof Blob) {
			body = object.body;
		} else {
			body = /** @type {BodyInit} */ (object.body);
		}

		return new Response(body, {
			headers: {
				'content-type': mime,
				'cache-control': 'private, max-age=3600',
				'content-length': String(object.size)
			}
		});
	} catch {
		error(404, 'Not found');
	}
}
