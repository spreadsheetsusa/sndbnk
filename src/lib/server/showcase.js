import { and, count, countDistinct, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';

import { parseGenres } from '#lib/genres.js';
import { db } from '#lib/server/db';
import { profile, track, trackComment, trackLike, user } from '#lib/server/db/schema';
import {
	getSocialForTracks,
	getTrackWithUploader,
	serializeTrackForPlayer
} from '#lib/server/tracks';

const HERO_POOL_SIZE = 12;

/**
 * Top liked published track ids for the hero player, cover art preferred.
 * Falls back to newest published with a cover when nobody has likes yet.
 *
 * @param {number} [limit]
 * @returns {Promise<string[]>}
 */
async function listHeroCandidateIds(limit = HERO_POOL_SIZE) {
	const likeCount = count(trackLike.userId);

	const liked = await db
		.select({
			id: track.id,
			coverFilename: track.coverFilename
		})
		.from(trackLike)
		.innerJoin(track, eq(trackLike.trackId, track.id))
		.where(eq(track.published, true))
		.groupBy(track.id, track.coverFilename, track.createdAt)
		.orderBy(desc(likeCount), desc(track.createdAt))
		.limit(limit);

	if (liked.length > 0) {
		const withCovers = liked.filter((row) => row.coverFilename);
		const pool = withCovers.length > 0 ? withCovers : liked;
		return pool.map((row) => row.id);
	}

	const newest = await db
		.select({ id: track.id })
		.from(track)
		.where(and(eq(track.published, true), isNotNull(track.coverFilename)))
		.orderBy(desc(track.createdAt), desc(track.id))
		.limit(limit);

	return newest.map((row) => row.id);
}

/**
 * One random top track for the marketing hero, fully serialized for playback
 * (includes waveform peaks). Returns null when the bank is empty.
 *
 * @param {{ id: string } | null | undefined} [viewer]
 */
export async function pickHeroTrack(viewer = null) {
	const ids = await listHeroCandidateIds();
	if (ids.length === 0) return null;

	const trackId = ids[Math.floor(Math.random() * ids.length)];
	const row = await getTrackWithUploader(trackId);
	if (!row) return null;

	const social = await getSocialForTracks([trackId], viewer?.id ?? null);
	return serializeTrackForPlayer(row.track, row, social.get(trackId), viewer);
}

/**
 * @typedef {Object} SiteStats
 * @property {number} trackCount
 * @property {number} artistCount
 * @property {number} totalDurationMs
 * @property {number} likeCount
 * @property {number} commentCount
 * @property {{ name: string, username: string | null, likeCount: number } | null} topArtist
 * @property {{ genre: string, count: number } | null} topGenre
 */

/**
 * Headline numbers for the landing page stat badges.
 * @returns {Promise<SiteStats>}
 */
export async function getSiteStats() {
	const artistLikes = count(trackLike.userId);
	const artistTracks = countDistinct(track.id);

	const [totals, likes, comments, topArtists, genreRows] = await Promise.all([
		db
			.select({
				trackCount: count(),
				artistCount: countDistinct(track.userId),
				totalDurationMs: sql`coalesce(sum(${track.durationMs}), 0)`.mapWith(Number)
			})
			.from(track)
			.where(eq(track.published, true)),
		db
			.select({ n: count() })
			.from(trackLike)
			.innerJoin(track, eq(track.id, trackLike.trackId))
			.where(eq(track.published, true)),
		db
			.select({ n: count() })
			.from(trackComment)
			.innerJoin(track, eq(track.id, trackComment.trackId))
			.where(eq(track.published, true)),
		db
			.select({
				name: user.name,
				username: profile.username,
				likeCount: artistLikes,
				trackCount: artistTracks
			})
			.from(track)
			.leftJoin(trackLike, eq(trackLike.trackId, track.id))
			.leftJoin(profile, eq(profile.userId, track.userId))
			.leftJoin(user, eq(user.id, track.userId))
			.where(eq(track.published, true))
			.groupBy(track.userId, user.name, profile.username)
			.orderBy(desc(artistLikes), desc(artistTracks))
			.limit(1),
		db
			.select({ genre: track.genre })
			.from(track)
			.where(and(eq(track.published, true), isNotNull(track.genre), ne(track.genre, '')))
	]);

	const top = topArtists[0];

	/** @type {Map<string, { genre: string, count: number }>} */
	const genreTallies = new Map();
	for (const row of genreRows) {
		for (const token of parseGenres(row.genre)) {
			const key = token.toLowerCase();
			const existing = genreTallies.get(key);
			if (existing) {
				existing.count += 1;
			} else {
				genreTallies.set(key, { genre: token, count: 1 });
			}
		}
	}
	const topGenreEntry = [...genreTallies.values()].sort(
		(a, b) => b.count - a.count || a.genre.localeCompare(b.genre)
	)[0];

	return {
		trackCount: totals[0]?.trackCount ?? 0,
		artistCount: totals[0]?.artistCount ?? 0,
		totalDurationMs: totals[0]?.totalDurationMs ?? 0,
		likeCount: likes[0]?.n ?? 0,
		commentCount: comments[0]?.n ?? 0,
		topArtist: top
			? {
					name: top.name ?? top.username ?? 'Unknown',
					username: top.username,
					likeCount: top.likeCount
				}
			: null,
		topGenre: topGenreEntry ?? null
	};
}

/**
 * Most recently created profiles for the landing page member grid.
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ username: string, name: string, image: string | null, location: string | null }[]>}
 */
export async function listLatestMembers({ limit = 12 } = {}) {
	const rows = await db
		.select({
			username: profile.username,
			name: user.name,
			image: user.image,
			location: profile.location
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.orderBy(desc(profile.createdAt))
		.limit(limit);

	return rows.map((row) => ({
		username: row.username,
		name: row.name,
		image: row.image ?? null,
		location: row.location ?? null
	}));
}
