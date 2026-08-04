import { eq } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { platformSettings } from '#lib/server/db/schema';

/**
 * Both thresholds mean accumulated playing time (pauses OK; seeking does not count).
 * @typedef {{ trackPlayPercent: number, mixPlayContinualMs: number }} PlayThresholds
 */

export const DEFAULT_TRACK_PLAY_PERCENT = 60;
export const DEFAULT_MIX_PLAY_CONTINUAL_MS = 600_000;
export const PLATFORM_SETTINGS_ID = 'default';

const MIN_MIX_PLAY_MS = 60_000;

/** @type {{ value: PlayThresholds, at: number } | null} */
let cache = null;
const CACHE_MS = 5000;

/**
 * @returns {PlayThresholds}
 */
function defaults() {
	return {
		trackPlayPercent: DEFAULT_TRACK_PLAY_PERCENT,
		mixPlayContinualMs: DEFAULT_MIX_PLAY_CONTINUAL_MS
	};
}

export function invalidatePlatformSettingsCache() {
	cache = null;
}

/**
 * Cached singleton play thresholds. Missing row falls back to defaults.
 * @returns {Promise<PlayThresholds>}
 */
export async function getPlatformSettings() {
	if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

	const rows = await db
		.select({
			trackPlayPercent: platformSettings.trackPlayPercent,
			mixPlayContinualMs: platformSettings.mixPlayContinualMs
		})
		.from(platformSettings)
		.where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
		.limit(1);

	const value = rows[0]
		? {
				trackPlayPercent: rows[0].trackPlayPercent,
				mixPlayContinualMs: rows[0].mixPlayContinualMs
			}
		: defaults();

	cache = { value, at: Date.now() };
	return value;
}

/**
 * @param {{ trackPlayPercent?: unknown, mixPlayContinualMs?: unknown, mixPlayContinualMinutes?: unknown }} input
 * @returns {Promise<{ ok: true, settings: PlayThresholds } | { ok: false, message: string }>}
 */
export async function updatePlatformSettings(input) {
	const percent = Number(input.trackPlayPercent);
	if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
		return { ok: false, message: 'Track play percent must be a whole number from 1 to 100.' };
	}

	let mixMs = Number(input.mixPlayContinualMs);
	if (input.mixPlayContinualMinutes != null && input.mixPlayContinualMinutes !== '') {
		const minutes = Number(input.mixPlayContinualMinutes);
		if (!Number.isFinite(minutes) || minutes <= 0) {
			return { ok: false, message: 'Mix play time must be a positive number of minutes.' };
		}
		mixMs = Math.round(minutes * 60_000);
	}

	if (!Number.isInteger(mixMs) || mixMs < MIN_MIX_PLAY_MS) {
		return { ok: false, message: 'Mix play time must be at least 1 minute.' };
	}

	const existing = await db
		.select({ id: platformSettings.id })
		.from(platformSettings)
		.where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
		.limit(1);

	if (existing[0]) {
		await db
			.update(platformSettings)
			.set({
				trackPlayPercent: percent,
				mixPlayContinualMs: mixMs,
				updatedAt: new Date()
			})
			.where(eq(platformSettings.id, PLATFORM_SETTINGS_ID));
	} else {
		await db.insert(platformSettings).values({
			id: PLATFORM_SETTINGS_ID,
			trackPlayPercent: percent,
			mixPlayContinualMs: mixMs
		});
	}

	invalidatePlatformSettingsCache();
	const settings = { trackPlayPercent: percent, mixPlayContinualMs: mixMs };
	cache = { value: settings, at: Date.now() };
	return { ok: true, settings };
}
