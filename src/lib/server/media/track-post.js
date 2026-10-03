import DOMPurify from 'isomorphic-dompurify';

import { getStorageAdapter, isMissingStorageObject, parseStoredAdapter } from '#lib/server/storage';

/** Sidecar written by the nocoast import. Lists `content-N` images in post order. */
export const CONTENT_MANIFEST = 'content.json';

const CONTENT_IMAGE_NAME = /^content-\d+\.(?:jpe?g|png|gif|webp)$/;
const CONTENT_SRC = /^\/api\/media\/[A-Za-z0-9-]+\/content-\d+\.(?:jpe?g|png|gif|webp)$/;

const PURIFY_OPTIONS = {
	ALLOWED_TAGS: ['p', 'br', 'img'],
	ALLOWED_ATTR: ['src', 'alt']
};

let hooksInstalled = false;

function ensurePurifyHooks() {
	if (hooksInstalled) return;
	hooksInstalled = true;
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (node.nodeName !== 'IMG') return;
		const src = node.getAttribute?.('src') ?? '';
		if (!CONTENT_SRC.test(src)) node.removeAttribute?.('src');
	});
}

/**
 * @param {Uint8Array | Blob | ReadableStream} body
 * @returns {Promise<string>}
 */
async function storageBodyText(body) {
	if (body instanceof Uint8Array) return new TextDecoder().decode(body);
	if (typeof Blob !== 'undefined' && body instanceof Blob) return body.text();
	const stream = /** @type {ReadableStream} */ (body);
	return new Response(stream).text();
}

/**
 * @param {typeof import('#lib/server/db/schema').track.$inferSelect} row
 * @returns {Promise<string[]>}
 */
export async function loadContentImages(row) {
	try {
		const storage = await getStorageAdapter(row.userId, parseStoredAdapter(row.storageAdapter));
		const stored = await storage.get(row.folderKey, CONTENT_MANIFEST);
		const parsed = JSON.parse(await storageBodyText(stored.body));
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((name) => typeof name === 'string' && CONTENT_IMAGE_NAME.test(name));
	} catch (err) {
		if (!isMissingStorageObject(err)) {
			console.error(
				`[track-post] content manifest unreadable for ${row.id}: ${err instanceof Error ? err.message : err}`
			);
		}
		return [];
	}
}

/**
 * Post images in source order, then the plain tracklist. Image URLs can only
 * point at this track's content files. The library editor keeps the plain text,
 * so a later save does not remove the image files.
 *
 * @param {string} trackId
 * @param {string | null | undefined} description
 * @param {string[]} filenames
 * @returns {string}
 */
export function renderTrackPostHtml(trackId, description, filenames) {
	const images = filenames.filter((name) => CONTENT_IMAGE_NAME.test(name));
	const text = description?.trim() ?? '';
	if (!text && images.length === 0) return '';

	const id = trackId.replace(/[^A-Za-z0-9-]/g, '');
	const imgs = images.map((name) => `<img src="/api/media/${id}/${name}" alt="">`).join('');
	const body = text ? `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>` : '';

	ensurePurifyHooks();
	return DOMPurify.sanitize(`${imgs}${body}`, PURIFY_OPTIONS).replace(/<img>/gi, '');
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
