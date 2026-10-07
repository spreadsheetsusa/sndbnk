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
 * `q` is a visitor search, not a saved block prop.
 * @typedef {{
 *   heading: string,
 *   headingAlign: StreamAlign,
 *   count: number | null,
 *   dateFrom: string | null,
 *   dateTo: string | null,
 *   genre: string | null,
 *   artists: string[],
 *   mediaType: StreamMediaType | null,
 *   q: string | null
 * }} StreamQuery
 */

/**
 * Visitor browse on top of the block query. Artist is the track credit, not the site profile.
 * @typedef {{
 *   q?: string | null,
 *   artist?: string | null,
 *   genre?: string | null
 * }} StreamBrowse
 */

/**
 * @typedef {{
 *   name: string,
 *   count: number
 * }} StreamFacet
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   artist: string,
 *   slug: string | null,
 *   username: string | null,
 *   likeCount: number,
 *   hasCover: boolean,
 *   coverUrl: string | null
 * }} StreamMostLiked
 */

/**
 * @typedef {{
 *   key: string,
 *   artists: StreamFacet[],
 *   genres: StreamFacet[],
 *   mostLiked: StreamMostLiked[]
 * }} StreamFacets
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
		mediaType: isTrackMediaType(row.mediaType) ? row.mediaType : null,
		q: parseStreamSearch(row.q)
	};
}

/**
 * Optional stream chrome. Missing props stay off so existing blocks do not change.
 * @param {Record<string, unknown> | null | undefined} props
 * @returns {{ showSearch: boolean, showSidebar: boolean }}
 */
export function parseStreamChrome(props) {
	const row = props ?? {};
	return {
		showSearch: row.showSearch === true,
		showSidebar: row.showSidebar === true
	};
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function parseStreamSearch(value) {
	if (typeof value !== 'string') return null;
	// `%` `_` `\` are LIKE wildcards. Drop them so a visitor query cannot widen the match.
	const q = value
		.trim()
		.slice(0, 80)
		.replace(/[%_\\]/g, '');
	return q || null;
}

/**
 * Overlay a visitor search / artist / genre onto the block query.
 * A selection replaces the inspector's artist or genre list. While browsing,
 * the display count is dropped so matches are not clipped to the first page.
 * @param {StreamQuery} query
 * @param {StreamBrowse} browse
 * @returns {StreamQuery}
 */
export function withStreamBrowse(query, browse) {
	const q = parseStreamSearch(browse.q);
	const artist = typeof browse.artist === 'string' ? browse.artist.trim() : '';
	const genre = typeof browse.genre === 'string' ? browse.genre.trim() : '';
	const active = Boolean(q || artist || genre);
	return {
		...query,
		count: active ? null : query.count,
		artists: artist ? parseArtists([artist]) : query.artists,
		genre: genre ? parseGenre(genre) : query.genre,
		q
	};
}

/**
 * @param {StreamBrowse} browse
 */
export function streamBrowseActive(browse) {
	return Boolean(
		parseStreamSearch(browse.q) ||
		(typeof browse.artist === 'string' && browse.artist.trim()) ||
		(typeof browse.genre === 'string' && browse.genre.trim())
	);
}

/**
 * Client-side match for the same fields the stream search query uses.
 * Reposts are not the site's own credits, so a browse hides them.
 * @param {Record<string, any>} item
 * @param {StreamBrowse} browse
 */
export function streamItemMatches(item, browse) {
	const q = (parseStreamSearch(browse.q) ?? '').toLowerCase();
	const artist = (typeof browse.artist === 'string' ? browse.artist.trim() : '').toLowerCase();
	const genre = (typeof browse.genre === 'string' ? browse.genre.trim() : '').toLowerCase();
	if (!q && !artist && !genre) return true;
	if (item?.repostedAt) return false;

	if (item?.kind === 'playlist') {
		const title = String(item.title ?? '').toLowerCase();
		const members = Array.isArray(item.tracks) ? item.tracks : [];
		const member = members.some((track) => streamItemMatches({ ...track, kind: 'track' }, browse));
		if (artist || genre) return member;
		return title.includes(q) || member;
	}

	const title = String(item?.title ?? '').toLowerCase();
	const credit = String(item?.artist ?? '').toLowerCase();
	const genres = String(item?.genre ?? '').toLowerCase();
	if (artist && credit !== artist) return false;
	if (genre && !parseGenres(item?.genre).some((token) => token.toLowerCase() === genre)) {
		return false;
	}
	if (!q) return true;
	return title.includes(q) || credit.includes(q) || genres.includes(q);
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
		query.mediaType ||
		query.q
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
		mediaType: query.mediaType,
		q: query.q
	});
}

/**
 * Identity for sidebar facets. The list cap and visitor search do not change them.
 * @param {StreamQuery} query
 */
export function streamFacetKey(query) {
	return JSON.stringify({
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
	if (query.q) params.q = query.q;
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
