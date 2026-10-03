import { parseGenres } from '#lib/genres.js';
import { isTrackMediaType } from '#lib/media/track-media-type.js';

/** Hard cap so a stream block cannot request an unbounded page. */
export const STREAM_COUNT_MAX = 48;

/** @type {readonly number[]} */
export const STREAM_COUNT_PRESETS = [6, 12, 24];

/** @typedef {'left' | 'center' | 'right'} StreamAlign */
/** @typedef {import('#lib/media/track-media-type.js').TrackMediaType} StreamMediaType */

/**
 * Normalized stream block props. Empty filters mean "the whole published catalog".
 * @typedef {{
 *   heading: string,
 *   headingAlign: StreamAlign,
 *   count: number | null,
 *   dateFrom: string | null,
 *   dateTo: string | null,
 *   genre: string | null,
 *   artists: string[],
 *   mediaType: StreamMediaType | null
 * }} StreamQuery
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ALIGNS = new Set(['left', 'center', 'right']);
/** Keeps credits like "The Hermit, Sam Link" as one artist in the query string. */
export const STREAM_ARTIST_SEP = '\u001f';

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parseCount(value) {
	if (value == null || value === '') return null;
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return null;
	const rounded = Math.round(n);
	if (rounded < 1) return null;
	return Math.min(STREAM_COUNT_MAX, rounded);
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function parseDate(value) {
	if (typeof value !== 'string' || !DATE.test(value)) return null;
	const [year, month, day] = value.split('-').map(Number);
	const utc = new Date(Date.UTC(year, month - 1, day));
	if (
		utc.getUTCFullYear() !== year ||
		utc.getUTCMonth() !== month - 1 ||
		utc.getUTCDate() !== day
	) {
		return null;
	}
	return value;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function parseGenre(value) {
	const raw = Array.isArray(value)
		? value.map((part) => String(part ?? '')).join(', ')
		: typeof value === 'string'
			? value
			: '';
	const parts = parseGenres(raw).slice(0, 6);
	return parts.length ? parts.join(', ') : null;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function parseArtists(value) {
	const raw = Array.isArray(value)
		? value
		: typeof value === 'string'
			? value.includes(STREAM_ARTIST_SEP)
				? value.split(STREAM_ARTIST_SEP)
				: value.split(',')
			: [];
	/** @type {Set<string>} */
	const seen = new Set();
	/** @type {string[]} */
	const out = [];
	for (const item of raw) {
		const name = String(item ?? '')
			.trim()
			.slice(0, 120);
		if (!name) continue;
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(name);
		if (out.length >= 8) break;
	}
	return out;
}

/**
 * @param {Record<string, unknown> | null | undefined} props
 * @returns {StreamQuery}
 */
export function parseStreamQuery(props) {
	const row = props ?? {};
	const align = row.headingAlign;
	return {
		heading: typeof row.heading === 'string' ? row.heading.slice(0, 120) : '',
		headingAlign: ALIGNS.has(/** @type {string} */ (align))
			? /** @type {StreamAlign} */ (align)
			: 'left',
		count: parseCount(row.count),
		dateFrom: parseDate(row.dateFrom),
		dateTo: parseDate(row.dateTo),
		genre: parseGenre(row.genre),
		artists: parseArtists(row.artists),
		mediaType: isTrackMediaType(row.mediaType) ? row.mediaType : null
	};
}

/**
 * True when the block should run its own catalog query instead of the profile timeline.
 * @param {StreamQuery} query
 */
export function streamQueryActive(query) {
	return Boolean(
		query.count ||
		query.dateFrom ||
		query.dateTo ||
		query.genre ||
		query.artists.length ||
		query.mediaType
	);
}

/**
 * Stable identity for a catalog query. Heading is display-only.
 * @param {StreamQuery} query
 */
export function streamQueryKey(query) {
	return JSON.stringify({
		count: query.count,
		dateFrom: query.dateFrom,
		dateTo: query.dateTo,
		genre: query.genre,
		artists: query.artists,
		mediaType: query.mediaType
	});
}

/**
 * Query-string fields for `GET /api/tracks?scope=stream`.
 * @param {StreamQuery} query
 * @returns {Record<string, string>}
 */
export function streamSearchParams(query) {
	/** @type {Record<string, string>} */
	const params = {};
	if (query.count) params.count = String(query.count);
	if (query.dateFrom) params.from = query.dateFrom;
	if (query.dateTo) params.to = query.dateTo;
	if (query.genre) params.genre = query.genre;
	if (query.artists.length) params.artists = query.artists.join(STREAM_ARTIST_SEP);
	if (query.mediaType) params.mediaType = query.mediaType;
	return params;
}

/**
 * Inclusive UTC calendar-day bounds. A reversed range is swapped so the filter still matches.
 * @param {StreamQuery} query
 * @returns {{ from: number | null, to: number | null }}
 */
export function streamDateBounds(query) {
	const from = query.dateFrom ? Date.parse(`${query.dateFrom}T00:00:00.000Z`) : null;
	const to = query.dateTo ? Date.parse(`${query.dateTo}T23:59:59.999Z`) : null;
	let start = Number.isFinite(from) ? from : null;
	let end = Number.isFinite(to) ? to : null;
	if (start != null && end != null && start > end) {
		const swap = start;
		start = end;
		end = swap;
	}
	return { from: start, to: end };
}
