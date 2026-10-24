import { and, count, eq } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { trackLike } from '#lib/server/db/schema';
import { recordTrackPlay } from '#lib/server/listens';
import { recordSitePlay } from '#lib/server/site-analytics';

/**
 * Plays, likes, and downloads each have one counter on the track
 * (`track.playCount`, `track_like`, `track.downloadCount`). The host that
 * sent the action — apex, `{user}.{base}`, or an active custom domain — does
 * not pick a different counter.
 *
 * A custom-domain-only catalog (active custom domain, Studio+, `publishToSndbnk`
 * off) still writes those same columns. It stays out of the sndbnk.com pool
 * through `visibleOnHostCondition`; the numbers are not split by host.
 * Settings → Audience (`site_stat_day` / `site_listen`) is an extra report for
 * plays on that custom domain. It is not a substitute for `track.playCount`.
 */

/**
 * @typedef {{ hostKind?: string, userId?: string } | null | undefined} PlayTenant
 */

/**
 * Count one qualified listen on the track counter, then (custom domains only)
 * mirror it into Audience. The mirror never replaces the track counter.
 *
 * @param {string} trackId
 * @param {{ userId?: string | null, tenant?: PlayTenant }} [source]
 */
export async function recordQualifiedPlay(trackId, { userId = null, tenant = null } = {}) {
	const result = await recordTrackPlay(trackId, { userId });
	if (!result.ok) return result;

	if (tenant?.hostKind === 'custom' && tenant.userId && userId !== tenant.userId) {
		try {
			await recordSitePlay({
				siteUserId: tenant.userId,
				trackId,
				listenerUserId: userId
			});
		} catch (err) {
			console.error('[site-analytics] play', err);
		}
	}

	return result;
}

/**
 * Toggle the viewer's like. The count is every row for this track, from every host.
 *
 * @param {string} trackId
 * @param {string} userId
 * @returns {Promise<{ liked: boolean, likeCount: number }>}
 */
export async function toggleTrackLike(trackId, userId) {
	const existing = await db
		.select({ trackId: trackLike.trackId })
		.from(trackLike)
		.where(and(eq(trackLike.trackId, trackId), eq(trackLike.userId, userId)))
		.limit(1);

	let liked;
	if (existing.length > 0) {
		await db
			.delete(trackLike)
			.where(and(eq(trackLike.trackId, trackId), eq(trackLike.userId, userId)));
		liked = false;
	} else {
		await db.insert(trackLike).values({ trackId, userId });
		liked = true;
	}

	const [{ n: likeCount }] = await db
		.select({ n: count() })
		.from(trackLike)
		.where(eq(trackLike.trackId, trackId));

	return { liked, likeCount };
}
