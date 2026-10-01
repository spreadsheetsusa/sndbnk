import { error } from '@sveltejs/kit';

import { getSiteMediaById, siteMediaFolderKey } from '#lib/server/site-media';
import { getPlatformObject } from '#lib/server/storage';

/**
 * `Range: bytes=...` without needing the object size first.
 * @param {string | null} header
 * @returns {{ start: number, end?: number } | { suffix: number } | null}
 */
function parseByteRange(header) {
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

export async function GET({ params, request, setHeaders }) {
	const row = await getSiteMediaById(params.assetId);
	if (!row) error(404, 'Not found');

	const rangeReq = parseByteRange(request.headers.get('range'));
	setHeaders({
		'cache-control': 'public, max-age=31536000, immutable',
		'accept-ranges': 'bytes',
		'x-content-type-options': 'nosniff'
	});

	try {
		if (!rangeReq) {
			const object = await getPlatformObject(row.userId, siteMediaFolderKey(row.id), row.filename);
			return new Response(/** @type {BodyInit} */ (object.body), {
				headers: {
					'content-type': row.mime || object.contentType,
					'content-length': String(object.size)
				}
			});
		}

		/** @type {import('#lib/server/storage/types.js').StorageByteRange} */
		let range;
		if ('suffix' in rangeReq) {
			const probe = await getPlatformObject(row.userId, siteMediaFolderKey(row.id), row.filename, {
				start: 0,
				end: 0
			});
			range = { start: Math.max(0, probe.size - rangeReq.suffix), end: probe.size - 1 };
		} else {
			range = rangeReq.end == null ? { start: rangeReq.start } : rangeReq;
		}

		const object = await getPlatformObject(
			row.userId,
			siteMediaFolderKey(row.id),
			row.filename,
			range
		);
		if (object.size <= 0 || range.start >= object.size) {
			return new Response(null, {
				status: 416,
				headers: { 'content-range': `bytes */${Math.max(object.size, 0)}` }
			});
		}
		const end = Math.min(range.end ?? object.size - 1, object.size - 1);
		const length = end - range.start + 1;
		return new Response(/** @type {BodyInit} */ (object.body), {
			status: 206,
			headers: {
				'content-type': row.mime || object.contentType,
				'content-length': String(length),
				'content-range': `bytes ${range.start}-${end}/${object.size}`
			}
		});
	} catch {
		error(404, 'Not found');
	}
}
