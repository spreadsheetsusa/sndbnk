import { and, count, countDistinct, desc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { profile, track, trackComment, trackLike, user } from '#lib/server/db/schema';
import { getSocialForTracks } from '#lib/server/tracks';

const SHOWCASE_LIMIT = 16;
const SHOWCASE_MIN_WITH_COVERS = 8;

/**
 * @param {number} limit
 * @param {boolean} withCover
 */
function selectShowcaseRows(limit, withCover) {
	return db
		.select({
			id: track.id,
			title: track.title,
			artist: track.artist,
			genre: track.genre,
			durationMs: track.durationMs,
			coverFilename: track.coverFilename,
			username: profile.username,
			uploaderName: user.name
		})
		.from(track)
		.leftJoin(profile, eq(profile.userId, track.userId))
		.leftJoin(user, eq(user.id, track.userId))
		.where(
			and(
				eq(track.published, true),
				withCover ? isNotNull(track.coverFilename) : isNull(track.coverFilename)
			)
		)
		.orderBy(desc(track.createdAt), desc(track.id))
		.limit(limit);
}

/**
 * Newest tracks for the landing page cover flow, cover art first so the band
 * reads as artwork. Intentionally skips `serializeTrackForPlayer()` — that
 * backfills waveform peaks by reading audio out of storage, and the carousel
 * only needs artwork and titles.
 *
 * @param {number} [limit]
 */
export async function listShowcaseTracks(limit = SHOWCASE_LIMIT) {
	const withCovers = await selectShowcaseRows(limit, true);

	const rows =
		withCovers.length >= SHOWCASE_MIN_WITH_COVERS
			? withCovers
			: [...withCovers, ...(await selectShowcaseRows(limit - withCovers.length, false))];

	const social = await getSocialForTracks(
		rows.map((row) => row.id),
		null
	);

	return rows.map((row) => ({
		id: row.id,
		title: row.title,
		artist: row.artist,
		genre: row.genre,
		durationMs: row.durationMs,
		hasCover: Boolean(row.coverFilename),
		username: row.username,
		uploaderName: row.uploaderName ?? row.username ?? 'Unknown',
		likeCount: social.get(row.id)?.likeCount ?? 0
	}));
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
	const genreCount = count();

	const [totals, likes, comments, topArtists, topGenres] = await Promise.all([
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
			.select({ genre: track.genre, n: genreCount })
			.from(track)
			.where(and(eq(track.published, true), isNotNull(track.genre), ne(track.genre, '')))
			.groupBy(track.genre)
			.orderBy(desc(genreCount))
			.limit(1)
	]);

	const top = topArtists[0];
	const genre = topGenres[0];

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
		topGenre: genre?.genre ? { genre: genre.genre, count: genre.n } : null
	};
}
