/**
 * Parametric EQ node helpers and persistence.
 * Plain JS (no runes) so resolution/defaults can change without touching UI wiring.
 */

/** @typedef {{ hz: number, gain: number, q: number }} EqNode */
/** @typedef {4 | 8} EqResolution */
/** @typedef {'default' | 'winamp' | 'lcd'} EqTheme */

export const EQ_GAIN_MIN = -12;
export const EQ_GAIN_MAX = 12;
export const EQ_FREQ_MIN = 20;
export const EQ_FREQ_MAX = 20000;
export const EQ_Q_MIN = 0.3;
export const EQ_Q_MAX = 8;
export const EQ_Q_DEFAULT = 1;
export const EQ_STORAGE_KEY = 'sndbnk:eq';

/** @type {readonly EqTheme[]} */
export const EQ_THEMES = Object.freeze(/** @type {const} */ (['default', 'winamp', 'lcd']));

/** Default flat layouts, log-spaced across the audible range. */
const DEFAULT_HZ_4 = Object.freeze([100, 400, 1600, 6400]);
const DEFAULT_HZ_8 = Object.freeze([60, 150, 400, 1000, 2500, 5000, 10000, 16000]);

/**
 * @typedef {{ enabled: boolean, resolution: EqResolution, nodes: EqNode[], theme: EqTheme }} EqStored
 */

/**
 * @param {number} db
 * @returns {number}
 */
export function clampGain(db) {
	if (!Number.isFinite(db)) return 0;
	return Math.min(EQ_GAIN_MAX, Math.max(EQ_GAIN_MIN, db));
}

/**
 * @param {number} hz
 * @returns {number}
 */
export function clampHz(hz) {
	if (!Number.isFinite(hz)) return EQ_FREQ_MIN;
	return Math.min(EQ_FREQ_MAX, Math.max(EQ_FREQ_MIN, hz));
}

/**
 * @param {number} q
 * @returns {number}
 */
export function clampQ(q) {
	if (!Number.isFinite(q)) return EQ_Q_DEFAULT;
	return Math.min(EQ_Q_MAX, Math.max(EQ_Q_MIN, q));
}

/**
 * @param {unknown} value
 * @returns {value is EqResolution}
 */
export function isEqResolution(value) {
	return value === 4 || value === 8;
}

/**
 * @param {unknown} value
 * @returns {value is EqTheme}
 */
export function isEqTheme(value) {
	return value === 'default' || value === 'winamp' || value === 'lcd';
}

/**
 * @param {EqResolution} resolution
 * @returns {EqNode[]}
 */
export function defaultNodes(resolution) {
	const centers = resolution === 8 ? DEFAULT_HZ_8 : DEFAULT_HZ_4;
	return centers.map((hz) => ({ hz, gain: 0, q: EQ_Q_DEFAULT }));
}

/**
 * @param {unknown} raw
 * @returns {EqNode | null}
 */
function parseNode(raw) {
	if (typeof raw !== 'object' || raw === null) return null;
	const row = /** @type {Record<string, unknown>} */ (raw);
	if (typeof row.hz !== 'number' || typeof row.gain !== 'number' || typeof row.q !== 'number') {
		return null;
	}
	return { hz: clampHz(row.hz), gain: clampGain(row.gain), q: clampQ(row.q) };
}

/**
 * @param {unknown} value
 * @returns {EqStored | null}
 */
export function parseStoredEq(value) {
	if (typeof value !== 'object' || value === null) return null;
	const row = /** @type {Record<string, unknown>} */ (value);
	if (typeof row.enabled !== 'boolean') return null;
	if (!isEqResolution(row.resolution)) return null;
	if (!Array.isArray(row.nodes) || row.nodes.length !== row.resolution) return null;
	const nodes = [];
	for (const entry of row.nodes) {
		const node = parseNode(entry);
		if (!node) return null;
		nodes.push(node);
	}
	const theme = isEqTheme(row.theme) ? row.theme : 'default';
	return { enabled: row.enabled, resolution: row.resolution, nodes, theme };
}
