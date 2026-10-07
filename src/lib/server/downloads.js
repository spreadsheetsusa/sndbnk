import { eq, sql } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { track } from '#lib/server/db/schema';
import { resolveDownloadSource } from '#lib/server/media/assets';
import { canViewTrack } from '#lib/server/tracks';

/**
 * Attachment name for the file the player is streaming.
 *
 * @param {string} filename
 * @param {string} title
 */
export function downloadAttachmentName(filename, title) {
	const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
	const base = (title || 'track').replace(/[^\w.\- ]+/g, '').trim() || 'track';
	return `${base}${ext}`;
}

/**
 * Whether this viewer may start a public download, and which object that is.
 * Does not increment the counter — the route does that after the object is found.
 *
 * @param {typeof track.$inferSelect} row
 * @param {string | null | undefined} viewerId
 * @returns {{ ok: true, filename: string, mime: string } | { ok: false, message: string, status: number }}
 */
export function openTrackDownload(row, viewerId) {
	if (!canViewTrack(row, viewerId)) {
		return { ok: false, message: 'Track not found.', status: 404 };
	}
	if (!row.canDownload) {
		return { ok: false, message: 'Downloads are turned off for this track.', status: 403 };
	}
	const source = resolveDownloadSource(row);
	if (!source) {
		return { ok: false, message: 'Download is not available yet.', status: 404 };
	}
	return { ok: true, filename: source.filename, mime: source.mime };
}

/**
 * Count one download kick-off. Anonymous downloads count, same as plays.
 *
 * @param {string} trackId
 * @returns {Promise<number>}
 */
export async function recordTrackDownload(trackId) {
	await db
		.update(track)
		.set({ downloadCount: sql`${track.downloadCount} + 1` })
		.where(eq(track.id, trackId));

	const updated = await db
		.select({ downloadCount: track.downloadCount })
		.from(track)
		.where(eq(track.id, trackId))
		.limit(1);

	return updated[0]?.downloadCount ?? 0;
}
