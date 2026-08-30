import { and, count, desc, eq, inArray, isNotNull, like, ne, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { parseGenres } from '#lib/genres.js';
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
import { listPlaylistRows } from '#lib/server/playlists';
import { likePattern, normalizeSearchQuery } from '#lib/server/search-query';
import { trackListedCondition } from '#lib/server/tracks';

export const FEED_PAGE_SIZE = 24;
const COMMENT_BODY_MAX = 80;

/**
 * Match title, artist, genre, or uploader username.
 * @param {string} term LIKE pattern from likePattern()
 */
function trackSearchCondition(term) {
	return or(
		like(track.title, term),
		like(track.artist, term),
		like(track.genre, term),
		like(profile.username, term)
	);
}

/**
 * Match a single genre token against the comma-separated `track.genre` field.
 * @param {string} genre
 */
function genreTokenCondition(genre) {
	const safe = genre.replace(/[%_]/g, '');
	if (!safe) return eq(track.genre, genre);
	return or(
		eq(track.genre, genre),
		like(track.genre, `${safe}, %`),
		like(track.genre, `%, ${safe}`),
		like(track.genre, `%, ${safe}, %`)
	);
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
 * @typedef {import('#lib/server/tracks').ProfileItemRow} FeedRow
 */

/**
 * Site-wide tracks (and playlists) newest first, with optional genre / text
 * filters and keyset cursor. Genre filters exclude playlists. With
 * `followingIds`, the feed is restricted to those users and also includes
 * tracks they reposted (ordered by repost time) plus their published playlists.
 *
 * @param {{
 *   limit?: number,
 *   cursor?: string | null,
 *   genre?: string | null,
 *   q?: string | null,
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
	q = null,
	followingIds = null,
	direction = 'older',
	inclusive = false
} = {}) {
	if (followingIds && followingIds.length === 0) {
		return { rows: [], nextCursor: null };
	}

	const decoded = cursor ? decodeCursor(cursor) : null;
	const search = normalizeSearchQuery(q);
	const term = search ? likePattern(search) : null;

	/** @type {import('drizzle-orm').SQL[]} */
	const conditions = [trackListedCondition()];
	if (genre) conditions.push(genreTokenCondition(genre));
	if (followingIds) conditions.push(inArray(track.userId, followingIds));
	if (term) conditions.push(trackSearchCondition(term));
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
		kind: /** @type {const} */ ('track'),
		repostedAt: null,
		repostedByName: null,
		repostedByUsername: null
	}));

	if (followingIds) {
		rows = [
			...rows,
			...(await listRepostedFeedRows({
				limit,
				genre,
				term,
				followingIds,
				decoded,
				direction,
				inclusive
			}))
		];
	}

	// Genre-filtered feeds stay track-only; otherwise merge published playlists.
	if (!genre) {
		const playlists = await listPlaylistRows({
			userIds: followingIds,
			publishedOnly: true,
			limit,
			cursor,
			direction,
			inclusive,
			q: search
		});
		rows = [
			...rows,
			...playlists.rows.map((row) => ({
				kind: /** @type {const} */ ('playlist'),
				playlist: row.playlist,
				username: row.username,
				uploaderName: row.uploaderName
			}))
		];
	}

	if (followingIds || !genre) {
		rows.sort(keysetComparator(sortAt, sortId, direction));
		rows = dedupeById(rows);
	}

	return keysetPage(rows, limit, feedRowCursor, direction);
}

/**
 * A repost enters the feed at the time it was reposted, not when it was uploaded.
 * @param {FeedRow} row
 */
function sortAt(row) {
	if (row.kind === 'playlist') return row.playlist.createdAt?.getTime() ?? 0;
	return row.repostedAt ?? row.track.createdAt?.getTime() ?? 0;
}

/**
 * @param {FeedRow} row
 */
function sortId(row) {
	return row.kind === 'playlist' ? row.playlist.id : row.track.id;
}

/**
 * @param {FeedRow} row
 */
function feedRowCursor(row) {
	return encodeCursor(sortAt(row), sortId(row));
}

/**
 * @param {FeedRow[]} rows sorted newest-event first
 */
function dedupeById(rows) {
	/** @type {Set<string>} */
	const seen = new Set();
	return rows.filter((row) => {
		const id = sortId(row);
		if (seen.has(id)) return false;
		seen.add(id);
		return true;
	});
}

/**
 * Tracks reposted by the given users, ordered by repost time.
 * @param {{
 *   limit: number,
 *   genre: string | null,
 *   term: string | null,
 *   followingIds: string[],
 *   decoded: { ms: number, id: string } | null,
 *   direction: import('#lib/server/cursor').Direction,
 *   inclusive: boolean
 * }} input
 * @returns {Promise<import('#lib/server/tracks').ProfileTrackRow[]>}
 */
async function listRepostedFeedRows({
	limit,
	genre,
	term,
	followingIds,
	decoded,
	direction,
	inclusive
}) {
	const reposter = alias(user, 'reposter');
	const reposterProfile = alias(profile, 'reposter_profile');

	/** @type {import('drizzle-orm').SQL[]} */
	const conditions = [trackListedCondition(), inArray(trackRepost.userId, followingIds)];
	if (genre) conditions.push(genreTokenCondition(genre));
	if (term) conditions.push(trackSearchCondition(term));
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
		kind: /** @type {const} */ ('track'),
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
			slug: track.slug,
			uploaderName: user.name,
			uploaderImage: user.image,
			username: profile.username,
			likeCount
		})
		.from(trackLike)
		.innerJoin(track, eq(trackLike.trackId, track.id))
		.leftJoin(profile, eq(profile.userId, track.userId))
		.leftJoin(user, eq(user.id, track.userId))
		.where(trackListedCondition())
		.groupBy(
			track.id,
			track.title,
			track.slug,
			user.name,
			user.image,
			profile.username,
			track.createdAt
		)
		.orderBy(desc(likeCount), desc(track.createdAt))
		.limit(limit);

	return rows.map((row) => ({
		id: row.id,
		title: row.title,
		slug: row.slug,
		uploaderName: row.uploaderName ?? row.username ?? 'Unknown',
		uploaderImage: row.uploaderImage ?? null,
		username: row.username ?? null,
		likeCount: row.likeCount
	}));
}

/**
 * Most recently created profiles, with the viewer's follow state.
 * @param {{ limit?: number, viewerId?: string | null }} [opts]
 */
export async function listNewArtists({ limit = 5, viewerId = null } = {}) {
	const rows = await db
		.select({
			userId: profile.userId,
			username: profile.username,
			name: user.name,
			image: user.image,
			createdAt: profile.createdAt
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
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
	const conditions = [trackListedCondition()];
	if (creatorId) conditions.push(eq(track.userId, creatorId));

	const ownerProfile = alias(profile, 'track_owner_profile');

	const rows = await db
		.select({
			id: trackComment.id,
			body: trackComment.body,
			createdAt: trackComment.createdAt,
			userName: user.name,
			userImage: user.image,
			username: profile.username,
			trackId: track.id,
			trackTitle: track.title,
			trackSlug: track.slug,
			trackUsername: ownerProfile.username
		})
		.from(trackComment)
		.innerJoin(track, eq(trackComment.trackId, track.id))
		.leftJoin(user, eq(user.id, trackComment.userId))
		.leftJoin(profile, eq(profile.userId, trackComment.userId))
		.leftJoin(ownerProfile, eq(ownerProfile.userId, track.userId))
		.where(and(...conditions))
		.orderBy(desc(trackComment.createdAt))
		.limit(limit);

	return rows.map((row) => ({
		id: row.id,
		body: truncateBody(row.body),
		createdAt: row.createdAt?.getTime() ?? Date.now(),
		userName: row.userName ?? 'Unknown',
		userImage: row.userImage ?? null,
		username: row.username ?? null,
		trackId: row.trackId,
		trackTitle: row.trackTitle,
		trackSlug: row.trackSlug,
		trackUsername: row.trackUsername ?? null
	}));
}

/**
 * Distinct genre tokens with track counts, most used first.
 * @param {number} [limit]
 */
export async function listGenres(limit = 12) {
	const rows = await db
		.select({ genre: track.genre })
		.from(track)
		.where(and(trackListedCondition(), isNotNull(track.genre), ne(track.genre, '')));

	/** @type {Map<string, { genre: string, count: number }>} */
	const tallies = new Map();
	for (const row of rows) {
		for (const token of parseGenres(row.genre)) {
			const key = token.toLowerCase();
			const existing = tallies.get(key);
			if (existing) {
				existing.count += 1;
			} else {
				tallies.set(key, { genre: token, count: 1 });
			}
		}
	}

	return [...tallies.values()]
		.sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre))
		.slice(0, limit);
}
