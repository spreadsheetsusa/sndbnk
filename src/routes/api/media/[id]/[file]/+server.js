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
 * Parse a `Range: bytes=...` header into a storage range without needing size.
 * Open-ended (`bytes=N-`) and suffix (`bytes=-N`) leave `end` unset / use suffix.
 *
 * @param {string | null} header
 * @returns {{ start: number, end?: number } | { suffix: number } | null}
 */
function parseRangeRequest(header) {
	if (!header) return null;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match) return null;

	const [, rawStart, rawEnd] = match;
	if (!rawStart && !rawEnd) return null;

	if (!rawStart) {
		const suffix = Number.parseInt(rawEnd, 10);
		if (!Number.isFinite(suffix) || suffix <= 0) return null;
		return { suffix };
	}

	const start = Number.parseInt(rawStart, 10);
	if (!Number.isFinite(start) || start < 0) return null;
	if (!rawEnd) return { start };

	const end = Number.parseInt(rawEnd, 10);
	if (!Number.isFinite(end) || end < start) return null;
	return { start, end };
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
 * @param {import('#lib/server/storage/types.js').StorageByteRange} [range]
 */
async function getWithRetry(adapter, folderKey, filename, range) {
	const delaysMs = [0, 120, 240];
	/** @type {unknown} */
	let lastErr;
	for (let i = 0; i < delaysMs.length; i++) {
		if (delaysMs[i] > 0) {
			await new Promise((resolve) => setTimeout(resolve, delaysMs[i]));
		}
		try {
			return await adapter.get(folderKey, filename, range);
		} catch (err) {
			lastErr = err;
			if (isMissingFileError(err)) throw err;
		}
	}
	throw lastErr;
}

/**
 * @param {Uint8Array | ReadableStream | Blob} body
 * @returns {BodyInit}
 */
function asBodyInit(body) {
	if (body instanceof Uint8Array) return body;
	if (typeof Blob !== 'undefined' && body instanceof Blob) return body;
	return /** @type {BodyInit} */ (body);
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
		const mimeHint = resolveMime(kind, row);
		const rangeReq = parseRangeRequest(request.headers.get('range'));

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

		if (!rangeReq) {
			const object = await getWithRetry(adapter, row.folderKey, filename);
			const mime = mimeHint || object.contentType;
			return new Response(asBodyInit(object.body), {
				headers: {
					'content-type': mime,
					'content-length': String(object.size)
				}
			});
		}

		/** @type {import('#lib/server/storage/types.js').StorageByteRange} */
		let range;
		if ('suffix' in rangeReq) {
			// Need full size to resolve suffix ranges; probe one byte.
			const probe = await getWithRetry(adapter, row.folderKey, filename, { start: 0, end: 0 });
			if (probe.size <= 0) error(416, 'Range Not Satisfiable');
			const start = Math.max(0, probe.size - rangeReq.suffix);
			range = { start, end: probe.size - 1 };
			if (range.start === 0 && range.end === 0) {
				const mime = mimeHint || probe.contentType;
				return new Response(asBodyInit(probe.body), {
					status: 206,
					headers: {
						'content-type': mime,
						'content-range': `bytes 0-0/${probe.size}`,
						'content-length': String(
							probe.body instanceof Blob
								? probe.body.size
								: probe.body instanceof Uint8Array
									? probe.body.byteLength
									: 1
						)
					}
				});
			}
		} else {
			range = rangeReq.end == null ? { start: rangeReq.start } : rangeReq;
		}

		const object = await getWithRetry(adapter, row.folderKey, filename, range);
		const mime = mimeHint || object.contentType;
		if (object.size <= 0 || range.start >= object.size) {
			error(416, 'Range Not Satisfiable');
		}
		const end = Math.min(range.end ?? object.size - 1, object.size - 1);
		const length =
			object.body instanceof Blob
				? object.body.size
				: object.body instanceof Uint8Array
					? object.body.byteLength
					: end - range.start + 1;

		return new Response(asBodyInit(object.body), {
			status: 206,
			headers: {
				'content-type': mime,
				'content-range': `bytes ${range.start}-${end}/${object.size}`,
				'content-length': String(length)
			}
		});
	} catch (err) {
		if (
			err &&
			typeof err === 'object' &&
			'status' in err &&
			/** @type {{ status?: number }} */ (err).status === 416
		) {
			throw err;
		}
		// Avoid sticky negative caching of transient SSH/storage misses.
		setHeaders({ 'cache-control': 'private, no-store' });
		error(404, 'Not found');
	}
}
