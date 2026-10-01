import { count, desc, eq } from 'drizzle-orm';

import { siteMediaUrl } from '#lib/site-media-url.js';
import { canEditSite } from '#lib/server/site';
import { db } from '#lib/server/db';
import { siteMedia } from '#lib/server/db/schema';
import { readFileHead, sniffImage, sniffVideo } from '#lib/server/media/sniff';
import { createPlatformAdapter, deletePlatformFolder } from '#lib/server/storage';

/** @typedef {import('#lib/server/db/schema').SiteMediaKind} SiteMediaKind */
/** @typedef {typeof siteMedia.$inferSelect} SiteMediaRow */

export const SITE_MEDIA_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const SITE_MEDIA_VIDEO_MAX_BYTES = 32 * 1024 * 1024;
export const SITE_MEDIA_MAX_COUNT = 200;
export const SITE_MEDIA_NAME_MAX = 80;

const STORED_FILENAME = 'file';

/**
 * One folder per asset under the owning user, so accounts never share a directory
 * and deleting an asset is a single folder wipe.
 * @param {string} assetId
 */
export function siteMediaFolderKey(assetId) {
	return `sm-${assetId}`;
}

/**
 * @param {string} value
 * @returns {{ ok: true, name: string } | { ok: false, message: string }}
 */
export function normalizeSiteMediaName(value) {
	const name = value
		.toString()
		.replace(/[\u0000-\u001f]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!name) return { ok: false, message: 'Give the file a name.' };
	if (name.length > SITE_MEDIA_NAME_MAX) {
		return { ok: false, message: `Names must be ${SITE_MEDIA_NAME_MAX} characters or fewer.` };
	}
	return { ok: true, name };
}

/**
 * @param {string} filename
 */
function nameFromUpload(filename) {
	const base = filename.replace(/\\/g, '/').split('/').pop() ?? '';
	const noExt = base.replace(/\.[^.]+$/, '') || 'Untitled';
	const normalized = normalizeSiteMediaName(noExt);
	return normalized.ok ? normalized.name : 'Untitled';
}

/**
 * @param {SiteMediaRow} row
 */
export function serializeSiteMedia(row) {
	return {
		id: row.id,
		name: row.name,
		kind: /** @type {SiteMediaKind} */ (row.kind),
		mime: row.mime,
		bytes: row.bytes,
		createdAt: row.createdAt.getTime(),
		url: siteMediaUrl(row.id)
	};
}

/**
 * @param {string} assetId
 */
export async function getSiteMediaById(assetId) {
	const rows = await db.select().from(siteMedia).where(eq(siteMedia.id, assetId)).limit(1);
	return rows[0] ?? null;
}

/**
 * @param {string} siteId
 * @param {string} assetId
 */
export async function getSiteMediaForSite(siteId, assetId) {
	const row = await getSiteMediaById(assetId);
	if (!row || row.siteId !== siteId) return null;
	return row;
}

/**
 * @param {string} siteId
 */
export async function listSiteMedia(siteId) {
	const rows = await db
		.select()
		.from(siteMedia)
		.where(eq(siteMedia.siteId, siteId))
		.orderBy(desc(siteMedia.createdAt));
	return rows.map(serializeSiteMedia);
}

/**
 * @param {File} file
 * @returns {Promise<
 *   | { ok: true, ext: string, mime: string, kind: SiteMediaKind, bytes: Uint8Array }
 *   | { ok: false, message: string }
 * >}
 */
async function readSiteMediaFile(file) {
	if (!(file instanceof File) || file.size <= 0) {
		return { ok: false, message: 'Choose an image or video to upload.' };
	}

	const head = await readFileHead(file, 32);
	const image = sniffImage(head);
	const video = image ? null : sniffVideo(head);
	const sniffed = image ?? video;
	if (!sniffed) {
		return {
			ok: false,
			message: 'Use a jpg, png, webp, gif, mp4, mov, or webm file.'
		};
	}

	const kind = /** @type {SiteMediaKind} */ (image ? 'image' : 'video');
	const max = kind === 'video' ? SITE_MEDIA_VIDEO_MAX_BYTES : SITE_MEDIA_IMAGE_MAX_BYTES;
	if (file.size > max) {
		const mb = Math.round(max / (1024 * 1024));
		return {
			ok: false,
			message: `${kind === 'video' ? 'Videos' : 'Images'} must be ${mb}MB or smaller.`
		};
	}

	const bytes = new Uint8Array(await file.arrayBuffer());
	return { ok: true, ext: sniffed.ext, mime: sniffed.mime, kind, bytes };
}

/**
 * @param {{
 *   userId: string,
 *   plan: string | null | undefined,
 *   siteId: string,
 *   file: File
 * }} input
 */
export async function createSiteMedia(input) {
	if (!canEditSite(input.plan)) {
		return {
			ok: /** @type {const} */ (false),
			message: 'Site builder needs Vault or higher.'
		};
	}

	const [{ total }] = await db
		.select({ total: count() })
		.from(siteMedia)
		.where(eq(siteMedia.siteId, input.siteId));
	if (total >= SITE_MEDIA_MAX_COUNT) {
		return {
			ok: /** @type {const} */ (false),
			message: `This site already has ${SITE_MEDIA_MAX_COUNT} files. Delete one to upload more.`
		};
	}

	const validated = await readSiteMediaFile(input.file);
	if (!validated.ok) return validated;

	const id = crypto.randomUUID();
	const filename = `${STORED_FILENAME}.${validated.ext}`;
	const folderKey = siteMediaFolderKey(id);
	const now = new Date();

	await db.insert(siteMedia).values({
		id,
		siteId: input.siteId,
		userId: input.userId,
		name: nameFromUpload(input.file.name),
		kind: validated.kind,
		filename,
		mime: validated.mime,
		bytes: validated.bytes.byteLength,
		createdAt: now,
		updatedAt: now
	});

	try {
		const storage = createPlatformAdapter(input.userId);
		await storage.put(folderKey, filename, validated.bytes, validated.mime);
	} catch (err) {
		await db.delete(siteMedia).where(eq(siteMedia.id, id));
		try {
			await deletePlatformFolder(input.userId, folderKey);
		} catch {
			// The row is gone; a leftover object is wiped with the user.
		}
		return {
			ok: /** @type {const} */ (false),
			message: err instanceof Error ? err.message : 'Could not store that file.'
		};
	}

	const row = await getSiteMediaById(id);
	if (!row) return { ok: /** @type {const} */ (false), message: 'Could not store that file.' };
	return { ok: /** @type {const} */ (true), item: serializeSiteMedia(row) };
}

/**
 * @param {{
 *   userId: string,
 *   plan: string | null | undefined,
 *   siteId: string,
 *   assetId: string,
 *   name: string
 * }} input
 */
export async function renameSiteMedia(input) {
	if (!canEditSite(input.plan)) {
		return { ok: /** @type {const} */ (false), message: 'Site builder needs Vault or higher.' };
	}
	const named = normalizeSiteMediaName(input.name);
	if (!named.ok) return named;

	const row = await getSiteMediaForSite(input.siteId, input.assetId);
	if (!row || row.userId !== input.userId) {
		return { ok: /** @type {const} */ (false), message: 'That file is not in this library.' };
	}

	await db
		.update(siteMedia)
		.set({ name: named.name, updatedAt: new Date() })
		.where(eq(siteMedia.id, row.id));

	const next = await getSiteMediaById(row.id);
	if (!next)
		return { ok: /** @type {const} */ (false), message: 'That file is not in this library.' };
	return { ok: /** @type {const} */ (true), item: serializeSiteMedia(next) };
}

/**
 * @param {{
 *   userId: string,
 *   plan: string | null | undefined,
 *   siteId: string,
 *   assetId: string
 * }} input
 */
export async function deleteSiteMedia(input) {
	if (!canEditSite(input.plan)) {
		return { ok: /** @type {const} */ (false), message: 'Site builder needs Vault or higher.' };
	}

	const row = await getSiteMediaForSite(input.siteId, input.assetId);
	if (!row || row.userId !== input.userId) {
		return { ok: /** @type {const} */ (false), message: 'That file is not in this library.' };
	}

	try {
		await deletePlatformFolder(input.userId, siteMediaFolderKey(row.id));
	} catch (err) {
		return {
			ok: /** @type {const} */ (false),
			message: err instanceof Error ? err.message : 'Could not delete that file.'
		};
	}

	await db.delete(siteMedia).where(eq(siteMedia.id, row.id));
	return { ok: /** @type {const} */ (true), id: row.id };
}
