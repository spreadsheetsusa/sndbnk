import { error } from '@sveltejs/kit';

import {
	downloadAttachmentName,
	openTrackDownload,
	recordTrackDownload
} from '#lib/server/downloads';
import { getTrackById } from '#lib/server/tracks';
import { getStorageAdapter, isMissingStorageObject, parseStoredAdapter } from '#lib/server/storage';
import { isTenantResourceAllowed } from '#lib/server/tenant';

/**
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
			if (isMissingStorageObject(err)) throw err;
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

export async function GET({ locals, params, setHeaders }) {
	const row = await getTrackById(params.id);
	if (!row || !isTenantResourceAllowed(locals, row.userId)) {
		error(404, 'Track not found');
	}

	const opened = openTrackDownload(row, locals.user?.id ?? null);
	if (!opened.ok) error(opened.status, opened.message);

	try {
		const adapter = await getStorageAdapter(row.userId, parseStoredAdapter(row.storageAdapter));
		const stored = await getWithRetry(adapter, row.folderKey, opened.filename);
		await recordTrackDownload(row.id);
		const filename = downloadAttachmentName(opened.filename, row.title);
		setHeaders({
			'cache-control': 'private, no-store',
			'x-content-type-options': 'nosniff'
		});
		return new Response(asBodyInit(stored.body), {
			headers: {
				'content-type': opened.mime || stored.contentType,
				'content-length': String(stored.size),
				'content-disposition': `attachment; filename="${filename}"`
			}
		});
	} catch {
		setHeaders({ 'cache-control': 'private, no-store' });
		error(404, 'Not found');
	}
}
