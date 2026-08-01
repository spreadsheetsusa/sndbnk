import { eq } from 'drizzle-orm';

import { auth } from '#lib/server/auth';
import { db } from '#lib/server/db';
import { profile, user } from '#lib/server/db/schema';
import { createLocalAdapter } from '#lib/server/storage/local.js';

/**
 * Avatars always live on local disk rather than the user's configured storage
 * adapter: they are requested on nearly every page, and proxying each one
 * through someone's SFTP server would be far too slow.
 */
export const AVATAR_FOLDER_KEY = 'avatar';
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** @type {Record<string, string>} */
const AVATAR_EXT_BY_MIME = {
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp'
};

/**
 * @param {string} filename
 */
function extFromName(filename) {
	const idx = filename.lastIndexOf('.');
	if (idx < 0) return '';
	return filename.slice(idx + 1).toLowerCase();
}

/**
 * Public URL for a stored avatar. The version stamp lets the response be
 * cached immutably while still updating the moment a new file is uploaded.
 * @param {string} userId
 * @param {Date} updatedAt
 */
export function avatarUrl(userId, updatedAt) {
	return `/api/avatar/${userId}?v=${updatedAt.getTime()}`;
}

/**
 * @param {File} file
 */
export function validateAvatarFile(file) {
	const mime = (file.type || '').toLowerCase();
	const ext = extFromName(file.name);
	const allowedExt = new Set(['jpg', 'jpeg', 'png', 'webp']);

	let resolvedExt = AVATAR_EXT_BY_MIME[mime];
	if (!resolvedExt && allowedExt.has(ext)) {
		resolvedExt = ext === 'jpeg' ? 'jpg' : ext;
	}

	if (!resolvedExt) {
		return {
			ok: /** @type {const} */ (false),
			message: 'Avatar must be a jpg, png, or webp image.'
		};
	}

	if (file.size > AVATAR_MAX_BYTES) {
		return { ok: /** @type {const} */ (false), message: 'Avatar must be 2MB or smaller.' };
	}

	return {
		ok: /** @type {const} */ (true),
		filename: `avatar.${resolvedExt}`,
		mime: mime || `image/${resolvedExt === 'jpg' ? 'jpeg' : resolvedExt}`
	};
}

/**
 * `user.image` is the canonical avatar URL every surface already reads, so
 * writing it here lights up the header, comments, and feed with no query changes.
 * @param {string} userId
 * @param {string | null} image
 * @param {Headers} headers
 */
async function setUserImage(userId, image, headers) {
	try {
		await auth.api.updateUser({ body: { image }, headers });
	} catch {
		await db.update(user).set({ image, updatedAt: new Date() }).where(eq(user.id, userId));
	}
}

/**
 * @param {string} userId
 * @param {File} file
 * @param {Headers} headers
 * @returns {Promise<{ ok: true, url: string } | { ok: false, message: string }>}
 */
export async function saveAvatar(userId, file, headers) {
	const validated = validateAvatarFile(file);
	if (!validated.ok) return validated;

	const storage = createLocalAdapter(userId);

	try {
		const bytes = new Uint8Array(await file.arrayBuffer());
		// Replacing jpg with png would otherwise leave the old file as the match.
		await storage.delete(AVATAR_FOLDER_KEY);
		await storage.put(AVATAR_FOLDER_KEY, validated.filename, bytes, validated.mime);
	} catch (err) {
		return {
			ok: false,
			message: err instanceof Error ? err.message : 'Could not save your avatar.'
		};
	}

	const updatedAt = new Date();
	await db
		.update(profile)
		.set({
			avatarFilename: validated.filename,
			avatarMime: validated.mime,
			updatedAt
		})
		.where(eq(profile.userId, userId));

	const url = avatarUrl(userId, updatedAt);
	await setUserImage(userId, url, headers);

	return { ok: true, url };
}

/**
 * @param {string} userId
 * @param {Headers} headers
 */
export async function removeAvatar(userId, headers) {
	try {
		await createLocalAdapter(userId).delete(AVATAR_FOLDER_KEY);
	} catch {
		// Nothing on disk is fine — clearing the record is what matters.
	}

	await db
		.update(profile)
		.set({ avatarFilename: null, avatarMime: null, updatedAt: new Date() })
		.where(eq(profile.userId, userId));

	await setUserImage(userId, null, headers);

	return { ok: /** @type {const} */ (true) };
}

/**
 * @param {string} userId
 */
export async function getAvatarRecord(userId) {
	const rows = await db
		.select({
			avatarFilename: profile.avatarFilename,
			avatarMime: profile.avatarMime
		})
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	return rows[0] ?? null;
}
