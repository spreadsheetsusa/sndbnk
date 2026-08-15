import { and, count, countDistinct, desc, eq, inArray, notInArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { db } from '#lib/server/db';
import { follow, profile, track, trackLike, trackRepost, user } from '#lib/server/db/schema';
import { isTrackListed, trackListedCondition } from '#lib/server/tracks';

const DEFAULT_ARTIST_LIMIT = 5;

/**
 * @typedef {Object} ArtistSummary
 * @property {string} username
 * @property {string} name
 * @property {string | null} image
 * @property {number} followerCount
 * @property {number} likeCount
 * @property {boolean} followedByViewer
 * @property {boolean} isViewer
 */

/**
 * Follow or unfollow, returning the new state and the target's follower count.
 * @param {string} followerId
 * @param {string} followingId
 */
export async function toggleFollow(followerId, followingId) {
	if (followerId === followingId) {
		return { ok: /** @type {const} */ (false), message: 'You cannot follow yourself.' };
	}

	const pair = and(eq(follow.followerId, followerId), eq(follow.followingId, followingId));
	const existing = await db
		.select({ followerId: follow.followerId })
		.from(follow)
		.where(pair)
		.limit(1);

	let following;
	if (existing.length > 0) {
		await db.delete(follow).where(pair);
		following = false;
	} else {
		await db.insert(follow).values({ followerId, followingId });
		following = true;
	}

	const [{ n }] = await db
		.select({ n: count() })
		.from(follow)
		.where(eq(follow.followingId, followingId));

	return { ok: /** @type {const} */ (true), following, followerCount: n };
}

/**
 * @param {string | null | undefined} followerId
 * @param {string} followingId
 */
export async function isFollowing(followerId, followingId) {
	if (!followerId || followerId === followingId) return false;

	const rows = await db
		.select({ followerId: follow.followerId })
		.from(follow)
		.where(and(eq(follow.followerId, followerId), eq(follow.followingId, followingId)))
		.limit(1);

	return rows.length > 0;
}

/**
 * User ids the given user follows.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function listFollowingIds(userId) {
	const rows = await db
		.select({ followingId: follow.followingId })
		.from(follow)
		.where(eq(follow.followerId, userId));

	return rows.map((row) => row.followingId);
}

/**
 * Repost or un-repost a track, returning the new state and total repost count.
 * Reposting your own track is rejected — it would duplicate the row on your profile.
 * Private published tracks cannot be reposted (would re-list them on the feed).
 * @param {string} userId
 * @param {string} trackId
 * @param {string} trackOwnerId
 * @param {{ published: boolean, isPrivate: boolean }} [trackRow]
 */
export async function toggleRepost(userId, trackId, trackOwnerId, trackRow) {
	if (userId === trackOwnerId) {
		return { ok: /** @type {const} */ (false), message: 'You cannot repost your own track.' };
	}
	if (trackRow && !isTrackListed(trackRow)) {
		return {
			ok: /** @type {const} */ (false),
			message: 'Private tracks cannot be reposted.'
		};
	}

	const pair = and(eq(trackRepost.trackId, trackId), eq(trackRepost.userId, userId));
	const existing = await db
		.select({ trackId: trackRepost.trackId })
		.from(trackRepost)
		.where(pair)
		.limit(1);

	let reposted;
	if (existing.length > 0) {
		await db.delete(trackRepost).where(pair);
		reposted = false;
	} else {
		await db.insert(trackRepost).values({ trackId, userId });
		reposted = true;
	}

	const [{ n }] = await db
		.select({ n: count() })
		.from(trackRepost)
		.where(eq(trackRepost.trackId, trackId));

	return { ok: /** @type {const} */ (true), reposted, repostCount: n };
}

/**
 * Counts for a creator's profile sidebar.
 * @param {string} userId
 */
export async function getProfileStats(userId) {
	const [followers, following, tracks, likes, reposts] = await Promise.all([
		db.select({ n: count() }).from(follow).where(eq(follow.followingId, userId)),
		db.select({ n: count() }).from(follow).where(eq(follow.followerId, userId)),
		db
			.select({ n: count() })
			.from(track)
			.where(and(eq(track.userId, userId), trackListedCondition())),
		db
			.select({ n: count() })
			.from(trackLike)
			.innerJoin(track, eq(track.id, trackLike.trackId))
			.where(and(eq(track.userId, userId), trackListedCondition())),
		db.select({ n: count() }).from(trackRepost).where(eq(trackRepost.userId, userId))
	]);

	return {
		followerCount: followers[0]?.n ?? 0,
		followingCount: following[0]?.n ?? 0,
		trackCount: tracks[0]?.n ?? 0,
		likeCount: likes[0]?.n ?? 0,
		repostCount: reposts[0]?.n ?? 0
	};
}

/**
 * Hydrate a set of user ids into artist rows, preserving the given order.
 * Users without a profile are dropped — there is nowhere to link them.
 *
 * @param {string[]} userIds
 * @param {string | null} viewerId
 * @returns {Promise<ArtistSummary[]>}
 */
export async function describeArtists(userIds, viewerId) {
	if (userIds.length === 0) return [];

	const [base, followerCounts, likeCounts, followed] = await Promise.all([
		db
			.select({
				userId: profile.userId,
				username: profile.username,
				name: user.name,
				image: user.image
			})
			.from(profile)
			.innerJoin(user, eq(user.id, profile.userId))
			.where(inArray(profile.userId, userIds)),
		db
			.select({ userId: follow.followingId, n: count() })
			.from(follow)
			.where(inArray(follow.followingId, userIds))
			.groupBy(follow.followingId),
		db
			.select({ userId: track.userId, n: count() })
			.from(trackLike)
			.innerJoin(track, eq(track.id, trackLike.trackId))
			.where(and(inArray(track.userId, userIds), trackListedCondition()))
			.groupBy(track.userId),
		viewerId
			? db
					.select({ userId: follow.followingId })
					.from(follow)
					.where(and(eq(follow.followerId, viewerId), inArray(follow.followingId, userIds)))
			: Promise.resolve([])
	]);

	const followerByUser = new Map(followerCounts.map((row) => [row.userId, row.n]));
	const likesByUser = new Map(likeCounts.map((row) => [row.userId, row.n]));
	const followedByViewer = new Set(followed.map((row) => row.userId));
	const byUser = new Map(base.map((row) => [row.userId, row]));

	return userIds.flatMap((id) => {
		const row = byUser.get(id);
		if (!row) return [];
		return [
			{
				username: row.username,
				name: row.name,
				image: row.image ?? null,
				followerCount: followerByUser.get(id) ?? 0,
				likeCount: likesByUser.get(id) ?? 0,
				followedByViewer: followedByViewer.has(id),
				isViewer: id === viewerId
			}
		];
	});
}

/**
 * People following the given user, newest first.
 * @param {string} userId
 * @param {string | null} viewerId
 * @param {number} [limit]
 */
export async function listFollowers(userId, viewerId, limit = DEFAULT_ARTIST_LIMIT) {
	const rows = await db
		.select({ userId: follow.followerId })
		.from(follow)
		.where(eq(follow.followingId, userId))
		.orderBy(desc(follow.createdAt))
		.limit(limit);

	return describeArtists(
		rows.map((row) => row.userId),
		viewerId
	);
}

/**
 * Artists liked by the people who like this artist, ranked by shared fans.
 * Falls back to the most-followed artists so a profile with no likes yet still
 * has something to browse.
 *
 * @param {string} userId
 * @param {string | null} viewerId
 * @param {number} [limit]
 */
export async function listFansAlsoLike(userId, viewerId, limit = DEFAULT_ARTIST_LIMIT) {
	const fanLike = alias(trackLike, 'fan_like');
	const fanTrack = alias(track, 'fan_track');
	const otherLike = alias(trackLike, 'other_like');
	const otherTrack = alias(track, 'other_track');
	const sharedFans = countDistinct(fanLike.userId);

	const rows = await db
		.select({ userId: otherTrack.userId, sharedFans })
		.from(fanLike)
		.innerJoin(fanTrack, eq(fanTrack.id, fanLike.trackId))
		.innerJoin(otherLike, eq(otherLike.userId, fanLike.userId))
		.innerJoin(otherTrack, eq(otherTrack.id, otherLike.trackId))
		.where(
			and(
				eq(fanTrack.userId, userId),
				eq(fanTrack.published, true),
				eq(fanTrack.isPrivate, false),
				eq(otherTrack.published, true),
				eq(otherTrack.isPrivate, false),
				notInArray(otherTrack.userId, excludedIds(userId, viewerId))
			)
		)
		.groupBy(otherTrack.userId)
		.orderBy(desc(sharedFans))
		.limit(limit);

	if (rows.length > 0) {
		return describeArtists(
			rows.map((row) => row.userId),
			viewerId
		);
	}

	return listPopularArtists(userId, viewerId, limit);
}

/**
 * Most-followed artists, minus the profile owner and the viewer (neither is a
 * useful suggestion). Ties break toward newer profiles.
 * @param {string} excludeUserId
 * @param {string | null} viewerId
 * @param {number} [limit]
 */
export async function listPopularArtists(excludeUserId, viewerId, limit = DEFAULT_ARTIST_LIMIT) {
	const followerCount = count(follow.followerId);

	const rows = await db
		.select({ userId: profile.userId, followerCount })
		.from(profile)
		.leftJoin(follow, eq(follow.followingId, profile.userId))
		.where(notInArray(profile.userId, excludedIds(excludeUserId, viewerId)))
		.groupBy(profile.userId, profile.createdAt)
		.orderBy(desc(followerCount), desc(profile.createdAt))
		.limit(limit);

	return describeArtists(
		rows.map((row) => row.userId),
		viewerId
	);
}

/**
 * @param {string} userId
 * @param {string | null} viewerId
 */
function excludedIds(userId, viewerId) {
	return viewerId && viewerId !== userId ? [userId, viewerId] : [userId];
}
