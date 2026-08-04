import { and, eq, or, sql } from 'drizzle-orm';

import {
	decodeCursor,
	encodeCursor,
	keysetComparator,
	keysetCondition,
	keysetOrder,
	keysetPage
} from '#lib/server/cursor';
import { db } from '#lib/server/db';
import {
	listenHistory,
	playlist,
	playlistLike,
	profile,
	track,
	trackLike,
	user
} from '#lib/server/db/schema';
import { TRACK_PAGE_SIZE, canViewTrack, getTrackById } from '#lib/server/tracks';

/**
 * @typedef {{
 *   limit?: number,
 *   cursor?: string | null,
 *   direction?: import('#lib/server/cursor').Direction,
 *   inclusive?: boolean
 * }} PageOptions
 */

/**
 * Increment the track's denormalized play count and, when signed in, upsert
 * listening history. Anonymous plays still count on the track.
 *
 * @param {string} trackId
 * @param {{ userId?: string | null }} [opts]
 * @returns {Promise<
 *   | { ok: true, playCount: number }
 *   | { ok: false, message: string, status?: number }
 * >}
 */
export async function recordTrackPlay(trackId, { userId = null } = {}) {
	const row = await getTrackById(trackId);
	if (!row || !canViewTrack(row, userId)) {
		return { ok: false, message: 'Track not found.', status: 404 };
	}

	await db
		.update(track)
		.set({ playCount: sql`${track.playCount} + 1` })
		.where(eq(track.id, row.id));

	if (userId) {
		const now = new Date();
		await db
			.insert(listenHistory)
			.values({
				userId,
				trackId: row.id,
				lastPlayedAt: now,
				playCount: 1
			})
			.onConflictDoUpdate({
				target: [listenHistory.userId, listenHistory.trackId],
				set: {
					lastPlayedAt: now,
					playCount: sql`${listenHistory.playCount} + 1`
				}
			});
	}

	const updated = await db
		.select({ playCount: track.playCount })
		.from(track)
		.where(eq(track.id, row.id))
		.limit(1);

	return { ok: true, playCount: updated[0]?.playCount ?? row.playCount + 1 };
}

/**
 * @param {string} userId
 * @param {PageOptions} [options]
 * @returns {Promise<{ rows: import('#lib/server/tracks').ProfileTrackRow[], nextCursor: string | null }>}
 */
export async function listListeningHistory(
	userId,
	{ limit = TRACK_PAGE_SIZE, cursor = null, direction = 'older', inclusive = false } = {}
) {
	const decoded = cursor ? decodeCursor(cursor) : null;

	/** @type {import('drizzle-orm').SQL[]} */
	const conditions = [
		eq(listenHistory.userId, userId),
		or(eq(track.published, true), eq(track.userId, userId))
	];
	if (decoded) {
		conditions.push(
			keysetCondition(
				listenHistory.lastPlayedAt,
				listenHistory.trackId,
				decoded,
				direction,
				inclusive
			)
		);
	}

	const fetched = await db
		.select({
			track: track,
			username: profile.username,
			uploaderName: user.name,
			lastPlayedAt: listenHistory.lastPlayedAt
		})
		.from(listenHistory)
		.innerJoin(track, eq(track.id, listenHistory.trackId))
		.leftJoin(profile, eq(profile.userId, track.userId))
		.leftJoin(user, eq(user.id, track.userId))
		.where(and(...conditions))
		.orderBy(...keysetOrder(listenHistory.lastPlayedAt, listenHistory.trackId, direction))
		.limit(limit + 1);

	/** @type {import('#lib/server/tracks').ProfileTrackRow[]} */
	const rows = fetched.map((row) => ({
		kind: /** @type {const} */ ('track'),
		track: row.track,
		username: row.username,
		uploaderName: row.uploaderName,
		listAt: row.lastPlayedAt?.getTime() ?? null,
		repostedAt: null
	}));

	return keysetPage(rows, limit, (row) => encodeCursor(row.listAt ?? 0, row.track.id), direction);
}

/**
 * Tracks and playlists a user has liked, newest like first. Public surfaces
 * only include published items.
 *
 * @param {string} userId
 * @param {PageOptions} [options]
 * @returns {Promise<{ rows: import('#lib/server/tracks').ProfileItemRow[], nextCursor: string | null }>}
 */
export async function listLikedItemsWithUploader(
	userId,
	{ limit = TRACK_PAGE_SIZE, cursor = null, direction = 'older', inclusive = false } = {}
) {
	const decoded = cursor ? decodeCursor(cursor) : null;

	/** @type {import('drizzle-orm').SQL[]} */
	const trackConditions = [eq(trackLike.userId, userId), eq(track.published, true)];
	/** @type {import('drizzle-orm').SQL[]} */
	const playlistConditions = [eq(playlistLike.userId, userId), eq(playlist.published, true)];

	if (decoded) {
		trackConditions.push(
			keysetCondition(trackLike.createdAt, trackLike.trackId, decoded, direction, inclusive)
		);
		playlistConditions.push(
			keysetCondition(
				playlistLike.createdAt,
				playlistLike.playlistId,
				decoded,
				direction,
				inclusive
			)
		);
	}

	const [likedTracks, likedPlaylists] = await Promise.all([
		db
			.select({
				track: track,
				username: profile.username,
				uploaderName: user.name,
				likedAt: trackLike.createdAt
			})
			.from(trackLike)
			.innerJoin(track, eq(track.id, trackLike.trackId))
			.leftJoin(profile, eq(profile.userId, track.userId))
			.leftJoin(user, eq(user.id, track.userId))
			.where(and(...trackConditions))
			.orderBy(...keysetOrder(trackLike.createdAt, trackLike.trackId, direction))
			.limit(limit + 1),
		db
			.select({
				playlist: playlist,
				username: profile.username,
				uploaderName: user.name,
				likedAt: playlistLike.createdAt
			})
			.from(playlistLike)
			.innerJoin(playlist, eq(playlist.id, playlistLike.playlistId))
			.leftJoin(profile, eq(profile.userId, playlist.userId))
			.leftJoin(user, eq(user.id, playlist.userId))
			.where(and(...playlistConditions))
			.orderBy(...keysetOrder(playlistLike.createdAt, playlistLike.playlistId, direction))
			.limit(limit + 1)
	]);

	/** @type {import('#lib/server/tracks').ProfileItemRow[]} */
	const rows = [
		...likedTracks.map((row) => ({
			kind: /** @type {const} */ ('track'),
			track: row.track,
			username: row.username,
			uploaderName: row.uploaderName,
			listAt: row.likedAt?.getTime() ?? null,
			repostedAt: null
		})),
		...likedPlaylists.map((row) => ({
			kind: /** @type {const} */ ('playlist'),
			playlist: row.playlist,
			username: row.username,
			uploaderName: row.uploaderName,
			listAt: row.likedAt?.getTime() ?? null
		}))
	];

	/**
	 * @param {import('#lib/server/tracks').ProfileItemRow} row
	 */
	const atOf = (row) => {
		if (row.kind === 'playlist') return row.listAt ?? row.playlist.createdAt?.getTime() ?? 0;
		return row.listAt ?? 0;
	};
	/**
	 * @param {import('#lib/server/tracks').ProfileItemRow} row
	 */
	const idOf = (row) => (row.kind === 'playlist' ? row.playlist.id : row.track.id);

	rows.sort(keysetComparator(atOf, idOf, direction));
	return keysetPage(rows, limit, (row) => encodeCursor(atOf(row), idOf(row)), direction);
}
