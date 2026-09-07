import { error } from '@sveltejs/kit';

import { resolveMasterSource, resolveStreamSource } from '#lib/server/media/assets';
import { mediaCorsOrigin } from '#lib/server/request-origin';
import { canViewTrack, getTrackById } from '#lib/server/tracks';
import { getStorageAdapter, isMissingStorageObject, parseStoredAdapter } from '#lib/server/storage';
import { isTenantResourceAllowed } from '#lib/server/tenant';

/**
 * @param {string} kind
 * @param {typeof import('#lib/server/db/schema').track.$inferSelect} row
 * @param {string | null | undefined} viewerId
 */
function resolveObject(kind, row, viewerId) {
	if (kind === 'cover') {
		if (!row.coverFilename) return null;
		return { filename: row.coverFilename, mime: row.coverMime ?? 'application/octet-stream' };
	}
	if (kind === 'audio') {
		const stream = resolveStreamSource(row);
		if (!stream) return null;
		return { filename: stream.filename, mime: stream.mime };
	}
	if (kind === 'master') {
		if (row.userId !== viewerId) return null;
		const master = resolveMasterSource(row);
		if (!master) return null;
		return { filename: master.filename, mime: master.mime, download: true };
	}
	return null;
}

/**
 * @param {string} filename
 * @param {string} title
 */
function attachmentFilename(filename, title) {
	const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
	const base = (title || 'track').replace(/[^\w.\- ]+/g, '').trim() || 'track';
	return `${base}${ext}`;
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
 * Definite absence — do not retry (local miss, SFTP ENOENT, S3 NoSuchKey).
 * @param {unknown} err
 */
function isMissingFileError(err) {
	return isMissingStorageObject(err);
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
	if (kind !== 'audio' && kind !== 'cover' && kind !== 'master') {
		error(404, 'Not found');
	}

	// Public read access: published tracks are playable from public profile pages.
	// Master download is owner-only (immutable original bytes).
	const row = await getTrackById(params.id);
	if (!row || !isTenantResourceAllowed(locals, row.userId) || !canViewTrack(row, locals.user?.id)) {
		error(404, 'Not found');
	}

	const resolved = resolveObject(kind, row, locals.user?.id);
	if (!resolved) {
		error(404, 'Not found');
	}
	const filename = resolved.filename;

	try {
		const adapter = await getStorageAdapter(row.userId, parseStoredAdapter(row.storageAdapter));
		const mimeHint = resolved.mime;
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
			const stored = await getWithRetry(adapter, row.folderKey, filename);
			const mime = mimeHint || stored.contentType;
			return new Response(asBodyInit(stored.body), {
				headers: {
					'content-type': mime,
					'content-length': String(stored.size),
					...(resolved.download
						? {
								'content-disposition': `attachment; filename="${attachmentFilename(filename, row.title)}"`
							}
						: {})
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
