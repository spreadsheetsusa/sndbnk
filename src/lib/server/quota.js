import { and, count, eq, sql } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { profile, track } from '#lib/server/db/schema';
import { planOrDefault } from '#lib/server/billing/plans';

/**
 * @typedef {{
 *   plan: string,
 *   planLabel: string,
 *   trackCount: number,
 *   maxTracks: number | null,
 *   localBytes: number,
 *   maxLocalBytes: number | null
 * }} Usage
 */

/**
 * Byte totals only count tracks on the `local` adapter — storage a creator brings
 * themselves is theirs to fill, which is the point of paying for the feature.
 * @param {string} userId
 * @returns {Promise<Usage>}
 */
export async function getUsage(userId) {
	const [planRows, totals, localBytes] = await Promise.all([
		db.select({ plan: profile.plan }).from(profile).where(eq(profile.userId, userId)).limit(1),
		db.select({ tracks: count() }).from(track).where(eq(track.userId, userId)),
		db
			.select({
				bytes: sql`coalesce(sum(${track.audioBytes} + coalesce(${track.coverBytes}, 0)), 0)`
			})
			.from(track)
			.where(and(eq(track.userId, userId), eq(track.storageAdapter, 'local')))
	]);

	const tier = planOrDefault(planRows[0]?.plan);

	return {
		plan: tier.id,
		planLabel: tier.label,
		trackCount: Number(totals[0]?.tracks ?? 0),
		maxTracks: tier.maxTracks,
		localBytes: Number(localBytes[0]?.bytes ?? 0),
		maxLocalBytes: tier.maxLocalBytes
	};
}

/**
 * @param {number} bytes
 */
export function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/**
 * Gate an upload against the account's tier.
 * @param {string} userId
 * @param {{ newTrack: boolean, addedBytes: number, adapter: string, replacesBytes?: number }} input
 * @returns {Promise<{ ok: true, usage: Usage } | { ok: false, message: string }>}
 */
export async function checkUploadAllowed(
	userId,
	{ newTrack, addedBytes, adapter, replacesBytes = 0 }
) {
	const usage = await getUsage(userId);

	if (newTrack && usage.maxTracks !== null && usage.trackCount >= usage.maxTracks) {
		return {
			ok: false,
			message: `${usage.planLabel} includes ${usage.maxTracks} tracks and you have ${usage.trackCount}. Upgrade your plan to add more.`
		};
	}

	if (adapter === 'local' && usage.maxLocalBytes !== null) {
		const projected = usage.localBytes - replacesBytes + addedBytes;
		if (projected > usage.maxLocalBytes) {
			return {
				ok: false,
				message: `That upload would put you over the ${formatBytes(usage.maxLocalBytes)} of hosted storage in ${usage.planLabel}. You are using ${formatBytes(usage.localBytes)}. Upgrade in Settings → Billing.`
			};
		}
	}

	return { ok: true, usage };
}
