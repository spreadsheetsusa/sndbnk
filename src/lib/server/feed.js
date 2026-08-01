import { and, count, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

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
	follow,
	profile,
	track,
	trackComment,
	trackLike,
	trackRepost,
	user
} from '#lib/server/db/schema';

export const FEED_PAGE_SIZE = 24;
const COMMENT_BODY_MAX = 80;

/**
 * @param {string} body
 * @param {number} [max]
 */
function truncateBody(body, max = COMMENT_BODY_MAX) {
	if (body.length <= max) return body;
	return `${body.slice(0, max - 1).trimEnd()}…`;
}

/**
 * @typedef {{
 *   track: typeof track.$inferSelect,
 *   username: string | null,
 *   uploaderName: string | null,
 *   repostedAt: number | null,
 *   repostedByName: string | null,
 *   repostedByUsername: string | null
 * }} FeedRow
 */

/**
 * Site-wide tracks newest first, with optional genre filter and keyset cursor.
 * With `followingIds`, the feed is restricted to those users and also includes
 * tracks they reposted, ordered by repost time rather than upload time.
 *
 * @param {{
 *   limit?: number,
 *   cursor?: string | null,
 *   genre?: string | null,
 *   followingIds?: string[] | null,
 *   direction?: import('#lib/server/cursor').Direction,
 *   inclusive?: boolean
 * }} [opts]
 * @returns {Promise<{ rows: FeedRow[], nextCursor: string | null }>}
 */
export async function listFeedTracks({
	limit = FEED_PAGE_SIZE,
	cursor = null,
	genre = null,
	followingIds = null,
	direction = 'older',
	inclusive = false
} = {}) {
	if (followingIds && followingIds.length === 0) {
		return { rows: [], nextCursor: null };
	}

	const decoded = cursor ? decodeCursor(cursor) : null;

	/** @type {import('drizzle-orm').SQL[]} */
	const conditions = [eq(track.published, true)];
	if (genre) conditions.push(eq(track.genre, genre));
	if (followingIds) conditions.push(inArray(track.userId, followingIds));
	if (decoded) {
		conditions.push(keysetCondition(track.createdAt, track.id, decoded, direction, inclusive));
	}

	const posted = await db
		.select({
			track: track,
			username: profile.username,
			uploaderName: user.name
		})
		.from(track)
		.leftJoin(profile, eq(profile.userId, track.userId))
		.leftJoin(user, eq(user.id, track.userId))
		.where(and(...conditions))
		.orderBy(...keysetOrder(track.createdAt, track.id, direction))
		.limit(limit + 1);

	/** @type {FeedRow[]} */
	let rows = posted.map((row) => ({
		...row,
		repostedAt: null,
		repostedByName: null,
		repostedByUsername: null
	}));

	if (followingIds) {
		rows = [
			...rows,
			...(await listRepostedFeedRows({ limit, genre, followingIds, decoded, direction, inclusive }))
		];
		rows.sort(keysetComparator(sortAt, (row) => row.track.id, direction));
		rows = dedupeByTrack(rows);
	}

	return keysetPage(rows, limit, feedRowCursor, direction);
}

/**
 * A repost enters the feed at the time it was reposted, not when it was uploaded.
 * @param {FeedRow} row
 */
function sortAt(row) {
	return row.repostedAt ?? row.track.createdAt?.getTime() ?? 0;
}

/**
 * @param {FeedRow} row
 */
function feedRowCursor(row) {
	return encodeCursor(sortAt(row), row.track.id);
}

/**
 * @param {FeedRow[]} rows sorted newest-event first
 */
function dedupeByTrack(rows) {
	/** @type {Set<string>} */
	const seen = new Set();
	return rows.filter((row) => {
		if (seen.has(row.track.id)) return false;
		seen.add(row.track.id);
		return true;
	});
}

/**
 * Tracks reposted by the given users, ordered by repost time.
 * @param {{
 *   limit: number,
 *   genre: string | null,
 *   followingIds: string[],
 *   decoded: { ms: number, id: string } | null,
 *   direction: import('#lib/server/cursor').Direction,
 *   inclusive: boolean
 * }} input
 * @returns {Promise<FeedRow[]>}
 */
async function listRepostedFeedRows({ limit, genre, followingIds, decoded, direction, inclusive }) {
	const reposter = alias(user, 'reposter');
	const reposterProfile = alias(profile, 'reposter_profile');

	/** @type {import('drizzle-orm').SQL[]} */
	const conditions = [eq(track.published, true), inArray(trackRepost.userId, followingIds)];
	if (genre) conditions.push(eq(track.genre, genre));
	if (decoded) {
		conditions.push(
			keysetCondition(trackRepost.createdAt, trackRepost.trackId, decoded, direction, inclusive)
		);
	}

	const rows = await db
		.select({
			track: track,
			username: profile.username,
			uploaderName: user.name,
			repostedAt: trackRepost.createdAt,
			repostedByName: reposter.name,
			repostedByUsername: reposterProfile.username
		})
		.from(trackRepost)
		.innerJoin(track, eq(track.id, trackRepost.trackId))
		.leftJoin(profile, eq(profile.userId, track.userId))
		.leftJoin(user, eq(user.id, track.userId))
		.leftJoin(reposter, eq(reposter.id, trackRepost.userId))
		.leftJoin(reposterProfile, eq(reposterProfile.userId, trackRepost.userId))
		.where(and(...conditions))
		.orderBy(...keysetOrder(trackRepost.createdAt, trackRepost.trackId, direction))
		.limit(limit + 1);

	return rows.map((row) => ({
		...row,
		repostedAt: row.repostedAt?.getTime() ?? null
	}));
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
		.where(eq(track.published, true))
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
 * Most recently created profiles, with track counts and the viewer's follow state.
 * @param {{ limit?: number, viewerId?: string | null }} [opts]
 */
export async function listNewArtists({ limit = 5, viewerId = null } = {}) {
	const trackCount = count(track.id);

	const rows = await db
		.select({
			userId: profile.userId,
			username: profile.username,
			name: user.name,
			image: user.image,
			trackCount,
			createdAt: profile.createdAt
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.leftJoin(track, and(eq(track.userId, profile.userId), eq(track.published, true)))
		.groupBy(profile.userId, profile.username, user.name, user.image, profile.createdAt)
		.orderBy(desc(profile.createdAt))
		.limit(limit);

	const userIds = rows.map((row) => row.userId);
	const followedRows =
		viewerId && userIds.length > 0
			? await db
					.select({ followingId: follow.followingId })
					.from(follow)
					.where(and(eq(follow.followerId, viewerId), inArray(follow.followingId, userIds)))
			: [];
	const followed = new Set(followedRows.map((row) => row.followingId));

	return rows.map((row) => ({
		username: row.username,
		name: row.name,
		image: row.image ?? null,
		trackCount: row.trackCount,
		isViewer: row.userId === viewerId,
		followedByViewer: followed.has(row.userId)
	}));
}

/**
 * Latest comments across the site, or across one creator's published tracks.
 * @param {{ limit?: number, creatorId?: string | null }} [opts]
 */
export async function listRecentComments({ limit = 5, creatorId = null } = {}) {
	/** @type {import('drizzle-orm').SQL[]} */
	const conditions = [eq(track.published, true)];
	if (creatorId) conditions.push(eq(track.userId, creatorId));

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
		.where(and(...conditions))
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
		.where(and(eq(track.published, true), isNotNull(track.genre), ne(track.genre, '')))
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
