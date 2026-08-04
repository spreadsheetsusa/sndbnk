/**
 * Client-side play thresholds, set once from root layout data.
 * The player reads these; cards never need them.
 */

/** @typedef {{ trackPlayPercent: number, mixPlayContinualMs: number }} PlayThresholds */

/** @type {PlayThresholds} */
let thresholds = {
	trackPlayPercent: 60,
	mixPlayContinualMs: 600_000
};

/**
 * @param {PlayThresholds | null | undefined} next
 */
export function setPlayThresholds(next) {
	if (!next) return;
	const percent = Number(next.trackPlayPercent);
	const mixMs = Number(next.mixPlayContinualMs);
	thresholds = {
		trackPlayPercent:
			Number.isFinite(percent) && percent >= 1 && percent <= 100
				? percent
				: thresholds.trackPlayPercent,
		mixPlayContinualMs:
			Number.isFinite(mixMs) && mixMs >= 60_000 ? mixMs : thresholds.mixPlayContinualMs
	};
}

/** @returns {PlayThresholds} */
export function getPlayThresholds() {
	return thresholds;
}
