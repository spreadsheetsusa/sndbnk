const UNITS = /** @type {const} */ ([
	['year', 365 * 24 * 60 * 60 * 1000],
	['month', 30 * 24 * 60 * 60 * 1000],
	['week', 7 * 24 * 60 * 60 * 1000],
	['day', 24 * 60 * 60 * 1000],
	['hour', 60 * 60 * 1000],
	['minute', 60 * 1000]
]);

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always', style: 'long' });

/**
 * "4 hours ago"-style relative timestamp.
 * @param {number} timestampMs
 * @param {number} [nowMs]
 * @returns {string}
 */
export function relativeTime(timestampMs, nowMs = Date.now()) {
	const delta = nowMs - timestampMs;
	if (delta < 60 * 1000) return 'just now';

	for (const [unit, ms] of UNITS) {
		if (delta >= ms) {
			return formatter.format(-Math.floor(delta / ms), unit);
		}
	}
	return 'just now';
}
