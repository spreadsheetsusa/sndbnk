import { error } from '@sveltejs/kit';

import { mediaCorsOrigin } from '#lib/server/request-origin';
import { canViewTrack, getTrackById } from '#lib/server/tracks';
import { getStorageAdapter } from '#lib/server/storage';
import { isTenantResourceAllowed } from '#lib/server/tenant';

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

/**
 * Parse a `Range: bytes=...` header against a known total size.
 * Only single ranges are supported (all browsers request media this way).
 *
 * @param {string | null} header
 * @param {number} size
 * @returns {{ start: number, end: number } | null}
 */
function parseRange(header, size) {
	if (!header || size <= 0) return null;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match) return null;

	const [, rawStart, rawEnd] = match;
	if (!rawStart && !rawEnd) return null;

	if (!rawStart) {
		// Suffix range: last N bytes.
		const suffix = Number.parseInt(rawEnd, 10);
		if (!Number.isFinite(suffix) || suffix <= 0) return null;
		const start = Math.max(0, size - suffix);
		return { start, end: size - 1 };
	}

	const start = Number.parseInt(rawStart, 10);
	const end = rawEnd ? Math.min(Number.parseInt(rawEnd, 10), size - 1) : size - 1;
	if (!Number.isFinite(start) || start >= size || start > end) return null;
	return { start, end };
}

/**
 * Slice a storage object body to a byte range without copying when possible.
 * @param {Uint8Array | ReadableStream | Blob} body
 * @param {number} start
 * @param {number} end Inclusive.
 * @returns {Promise<BodyInit>}
 */
async function sliceBody(body, start, end) {
	if (body instanceof Uint8Array) {
		return body.subarray(start, end + 1);
	}
	if (typeof Blob !== 'undefined' && body instanceof Blob) {
		// Bun.file slices are lazy, so local storage never reads the full file.
		return body.slice(start, end + 1);
	}
	const bytes = new Uint8Array(await new Response(body).arrayBuffer());
	return bytes.subarray(start, end + 1);
}

/**
 * Definite absence — do not retry (local missing file, SFTP ENOENT).
 * @param {unknown} err
 */
function isMissingFileError(err) {
	if (!(err instanceof Error)) return false;
	if (err.message === 'File not found.') return true;
	const code = /** @type {{ code?: number | string }} */ (err).code;
	return code === 2 || code === 'ENOENT';
}

/**
 * Retry transient storage failures (SSH connect blips). Skip clear misses.
 *
 * @param {import('#lib/server/storage/types.js').StorageAdapter} adapter
 * @param {string} folderKey
 * @param {string} filename
 */
async function getWithRetry(adapter, folderKey, filename) {
	const delaysMs = [0, 120, 240];
	/** @type {unknown} */
	let lastErr;
	for (let i = 0; i < delaysMs.length; i++) {
		if (delaysMs[i] > 0) {
			await new Promise((resolve) => setTimeout(resolve, delaysMs[i]));
		}
		try {
			return await adapter.get(folderKey, filename);
		} catch (err) {
			lastErr = err;
			if (isMissingFileError(err)) throw err;
		}
	}
	throw lastErr;
}

export async function GET({ locals, params, request, setHeaders, url }) {
	const kind = params.file;
	if (kind !== 'audio' && kind !== 'cover') {
		error(404, 'Not found');
	}

	// Public read access: published tracks are playable from public profile pages.
	const row = await getTrackById(params.id);
	if (!row || !isTenantResourceAllowed(locals, row.userId) || !canViewTrack(row, locals.user?.id)) {
		error(404, 'Not found');
	}

	const filename = resolveFilename(kind, row);
	if (!filename) {
		error(404, 'Not found');
	}

	try {
		const adapter = await getStorageAdapter(
			row.userId,
			/** @type {'local' | 'ssh'} */ (row.storageAdapter)
		);
		const object = await getWithRetry(adapter, row.folderKey, filename);
		const mime = resolveMime(kind, row) || object.contentType;

		// ACAO so <audio crossOrigin="anonymous"> can feed MediaElementSource analysers
		// (Milkdrop). Only first-party origins (apex + tenant hosts).
		const allowOrigin = mediaCorsOrigin(request, url);

		// Published covers are share/OG assets — allow shared caches. Audio and
		// unpublished owner previews stay private.
		const cacheControl =
			kind === 'cover' && row.published ? 'public, max-age=3600' : 'private, max-age=3600';

		setHeaders({
			'accept-ranges': 'bytes',
			'cache-control': cacheControl,
			'x-content-type-options': 'nosniff',
			...(allowOrigin ? { 'access-control-allow-origin': allowOrigin, vary: 'Origin' } : {})
		});

		const range = parseRange(request.headers.get('range'), object.size);
		if (range) {
			const body = await sliceBody(object.body, range.start, range.end);
			return new Response(body, {
				status: 206,
				headers: {
					'content-type': mime,
					'content-range': `bytes ${range.start}-${range.end}/${object.size}`,
					'content-length': String(range.end - range.start + 1)
				}
			});
		}

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
				'content-length': String(object.size)
			}
		});
	} catch {
		// Avoid sticky negative caching of transient SSH/storage misses.
		setHeaders({ 'cache-control': 'private, no-store' });
		error(404, 'Not found');
	}
}
