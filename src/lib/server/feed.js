import { and, count, desc, eq, isNotNull, lt, ne, or } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { profile, track, trackComment, trackLike, user } from '#lib/server/db/schema';

const DEFAULT_FEED_LIMIT = 24;
const COMMENT_BODY_MAX = 80;

/**
 * @param {Date | number} createdAt
 * @param {string} id
 */
export function encodeFeedCursor(createdAt, id) {
	const ms = createdAt instanceof Date ? createdAt.getTime() : createdAt;
	return `${ms}_${id}`;
}

/**
 * @param {string} cursor
 * @returns {{ ms: number, id: string } | null}
 */
export function decodeFeedCursor(cursor) {
	const idx = cursor.indexOf('_');
	if (idx < 0) return null;
	const ms = Number(cursor.slice(0, idx));
	const id = cursor.slice(idx + 1);
	if (!Number.isFinite(ms) || !id) return null;
	return { ms, id };
}

/**
 * @param {string} body
 * @param {number} [max]
 */
function truncateBody(body, max = COMMENT_BODY_MAX) {
	if (body.length <= max) return body;
	return `${body.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Site-wide tracks newest first, with optional genre filter and keyset cursor.
 *
 * @param {{
 *   limit?: number,
 *   cursor?: string | null,
 *   genre?: string | null
 * }} [opts]
 */
export async function listFeedTracks({
	limit = DEFAULT_FEED_LIMIT,
	cursor = null,
	genre = null
} = {}) {
	/** @type {import('drizzle-orm').SQL[]} */
	const conditions = [];

	if (genre) {
		conditions.push(eq(track.genre, genre));
	}

	if (cursor) {
		const decoded = decodeFeedCursor(cursor);
		if (decoded) {
			const at = new Date(decoded.ms);
			conditions.push(
				or(lt(track.createdAt, at), and(eq(track.createdAt, at), lt(track.id, decoded.id)))
			);
		}
	}

	const base = db
		.select({
			track: track,
			username: profile.username,
			uploaderName: user.name
		})
		.from(track)
		.leftJoin(profile, eq(profile.userId, track.userId))
		.leftJoin(user, eq(user.id, track.userId));

	const filtered = conditions.length > 0 ? base.where(and(...conditions)) : base;

	const rows = await filtered.orderBy(desc(track.createdAt), desc(track.id)).limit(limit + 1);

	const hasMore = rows.length > limit;
	const page = hasMore ? rows.slice(0, limit) : rows;
	const last = page[page.length - 1];
	const nextCursor =
		hasMore && last ? encodeFeedCursor(last.track.createdAt ?? Date.now(), last.track.id) : null;

	return { rows: page, nextCursor };
}

/**
 * Top tracks by like count.
 * @param {number} [limit]
 */
export async function listMostLikedTracks(limit = 5) {
	const likeCount = count(trackLike.userId);

	const rows = await db
		.select({
			id: track.id,
			title: track.title,
			uploaderName: user.name,
			username: profile.username,
			likeCount
		})
		.from(trackLike)
		.innerJoin(track, eq(trackLike.trackId, track.id))
		.leftJoin(profile, eq(profile.userId, track.userId))
		.leftJoin(user, eq(user.id, track.userId))
		.groupBy(track.id, track.title, user.name, profile.username, track.createdAt)
		.orderBy(desc(likeCount), desc(track.createdAt))
		.limit(limit);

	return rows.map((row) => ({
		id: row.id,
		title: row.title,
		uploaderName: row.uploaderName ?? row.username ?? 'Unknown',
		username: row.username ?? null,
		likeCount: row.likeCount
	}));
}

/**
 * Most recently created profiles, with track counts.
 * @param {number} [limit]
 */
export async function listNewArtists(limit = 5) {
	const trackCount = count(track.id);

	const rows = await db
		.select({
			username: profile.username,
			name: user.name,
			image: user.image,
			trackCount,
			createdAt: profile.createdAt
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.leftJoin(track, eq(track.userId, profile.userId))
		.groupBy(profile.userId, profile.username, user.name, user.image, profile.createdAt)
		.orderBy(desc(profile.createdAt))
		.limit(limit);

	return rows.map((row) => ({
		username: row.username,
		name: row.name,
		image: row.image ?? null,
		trackCount: row.trackCount
	}));
}

/**
 * Latest comments across the site.
 * @param {number} [limit]
 */
export async function listRecentComments(limit = 5) {
	const rows = await db
		.select({
			id: trackComment.id,
			body: trackComment.body,
			createdAt: trackComment.createdAt,
			userName: user.name,
			userImage: user.image,
			trackId: track.id,
			trackTitle: track.title
		})
		.from(trackComment)
		.innerJoin(track, eq(trackComment.trackId, track.id))
		.leftJoin(user, eq(user.id, trackComment.userId))
		.orderBy(desc(trackComment.createdAt))
		.limit(limit);

	return rows.map((row) => ({
		id: row.id,
		body: truncateBody(row.body),
		createdAt: row.createdAt?.getTime() ?? Date.now(),
		userName: row.userName ?? 'Unknown',
		userImage: row.userImage ?? null,
		trackId: row.trackId,
		trackTitle: row.trackTitle
	}));
}

/**
 * Distinct genres with track counts, most used first.
 * @param {number} [limit]
 */
export async function listGenres(limit = 12) {
	const n = count();

	const rows = await db
		.select({
			genre: track.genre,
			n
		})
		.from(track)
		.where(and(isNotNull(track.genre), ne(track.genre, '')))
		.groupBy(track.genre)
		.orderBy(desc(n))
		.limit(limit);

	return rows
		.filter((row) => row.genre)
		.map((row) => ({
			genre: /** @type {string} */ (row.genre),
			count: row.n
		}));
}
