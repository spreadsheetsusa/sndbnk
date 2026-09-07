/** First paid rung — Free's 15-track wall lands here. */
export const VAULT_CHECKOUT_HREF = '/plans?plan=vault';
export const STUDIO_CHECKOUT_HREF = '/plans?plan=studio';

/** Warn when this many tracks remain before the Free album wall. */
export const TRACK_CAP_WARN_REMAINING = 3;

/**
 * Official marketing copy for the four seeded plan ids.
 * Entitlements (caps, flags, prices) stay in `scripts/migrate-sqlite.js`.
 *
 * @type {Record<'free' | 'vault' | 'studio' | 'label', { blurb: string, features: string[] }>}
 */
export const PLAN_MARKETING = {
	free: {
		blurb: 'One album to start — about 15 tracks on a public profile.',
		features: [
			'Public profile at sndbnk.com/users/you',
			'One album (~15 tracks)',
			'Bring your own storage'
		]
	},
	vault: {
		blurb: 'Unlimited tracks plus you.sndbnk.com.',
		features: [
			'Everything in Free',
			'Unlimited tracks',
			'Subdomain at you.sndbnk.com',
			'Bring your own storage'
		]
	},
	studio: {
		blurb: 'Your domain. Chrome off. Full station design.',
		features: [
			'Everything in Vault',
			'Custom domain via CNAME',
			'Remove SNDBNK branding',
			'Full station builder',
			'Bring your own storage'
		]
	},
	label: {
		blurb: 'Teams and scale — roster desks coming soon.',
		features: ['Everything in Studio', 'Teams (coming soon) — 5 seats', 'Bring your own storage']
	}
};

/**
 * Previous official blurbs — migrate refreshes rows that still carry these.
 * @type {string[]}
 */
export const RETIRED_PLAN_BLURBS = [
	'Fully usable forever — especially with your own storage.',
	'Your own subdomain on sndbnk.com.',
	'Your own domain. Your own design. Full power.',
	'Teams and scale for serious catalogs.'
];

/**
 * @param {number} trackCount
 * @param {number | null | undefined} maxTracks
 */
export function isAtTrackCap(trackCount, maxTracks) {
	return maxTracks != null && trackCount >= maxTracks;
}

/**
 * @param {number} trackCount
 * @param {number | null | undefined} maxTracks
 */
export function isNearTrackCap(trackCount, maxTracks) {
	if (maxTracks == null || trackCount >= maxTracks) return false;
	return trackCount >= maxTracks - TRACK_CAP_WARN_REMAINING;
}

/**
 * Checkout target when an upload or quota meter hits a wall.
 * Track caps (Free's album) go to Vault; hosted-byte caps go to the catalog.
 *
 * @param {{
 *   trackCount: number,
 *   maxTracks: number | null,
 *   localBytes?: number,
 *   maxLocalBytes?: number | null
 * }} usage
 */
export function upgradeHrefForQuota(usage) {
	if (isAtTrackCap(usage.trackCount, usage.maxTracks)) return VAULT_CHECKOUT_HREF;
	if (isNearTrackCap(usage.trackCount, usage.maxTracks)) return VAULT_CHECKOUT_HREF;
	return '/plans';
}
