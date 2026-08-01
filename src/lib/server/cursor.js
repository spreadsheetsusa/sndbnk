import { and, asc, desc, eq, gt, gte, lt, lte, or } from 'drizzle-orm';

/**
 * Keyset pagination over lists ordered by `(at, id)` descending.
 *
 * `older` walks away from the newest item; `newer` walks back toward it, which is
 * what lets a restored view fetch a window around where the reader left off
 * instead of every page above it.
 *
 * @typedef {'older' | 'newer'} Direction
 */

/**
 * @param {Date | number} at
 * @param {string} id
 */
export function encodeCursor(at, id) {
	const ms = at instanceof Date ? at.getTime() : at;
	return `${ms}_${id}`;
}

/**
 * @param {string} cursor
 * @returns {{ ms: number, id: string } | null}
 */
export function decodeCursor(cursor) {
	const idx = cursor.indexOf('_');
	if (idx < 0) return null;
	const ms = Number(cursor.slice(0, idx));
	const id = cursor.slice(idx + 1);
	if (!Number.isFinite(ms) || !id) return null;
	return { ms, id };
}

/**
 * Tuple comparison against the cursor, tie-broken on id.
 * `inclusive` keeps the cursor row itself, so a restore can start *at* its anchor.
 *
 * @param {import('drizzle-orm/sqlite-core').SQLiteColumn} atColumn
 * @param {import('drizzle-orm/sqlite-core').SQLiteColumn} idColumn
 * @param {{ ms: number, id: string }} decoded
 * @param {Direction} direction
 * @param {boolean} [inclusive]
 */
export function keysetCondition(atColumn, idColumn, decoded, direction, inclusive = false) {
	const at = new Date(decoded.ms);
	const [strict, orEqual] = direction === 'older' ? [lt, lte] : [gt, gte];
	const compareId = inclusive ? orEqual : strict;
	return or(strict(atColumn, at), and(eq(atColumn, at), compareId(idColumn, decoded.id)));
}

/**
 * Fetch order for a direction: always nearest the cursor first, so an
 * over-fetched page can be trimmed from the far end.
 *
 * @param {import('drizzle-orm/sqlite-core').SQLiteColumn} atColumn
 * @param {import('drizzle-orm/sqlite-core').SQLiteColumn} idColumn
 * @param {Direction} direction
 */
export function keysetOrder(atColumn, idColumn, direction) {
	return direction === 'older' ? [desc(atColumn), desc(idColumn)] : [asc(atColumn), asc(idColumn)];
}

/**
 * Trim rows fetched with `limit + 1` to one page and derive the cursor that
 * continues in the same direction. Returned rows are always newest-first,
 * whichever way the page was walked.
 *
 * @template T
 * @param {T[]} rows ordered nearest-the-cursor first
 * @param {number} limit
 * @param {(row: T) => string} cursorOf
 * @param {Direction} direction
 * @returns {{ rows: T[], nextCursor: string | null }}
 */
export function keysetPage(rows, limit, cursorOf, direction) {
	const hasMore = rows.length > limit;
	const page = hasMore ? rows.slice(0, limit) : rows;
	const last = page.at(-1);
	return {
		rows: direction === 'newer' ? page.toReversed() : page,
		nextCursor: hasMore && last ? cursorOf(last) : null
	};
}

/**
 * Comparator for merging two keyset sources in memory, matching the SQL order.
 *
 * @template T
 * @param {(row: T) => number} atOf
 * @param {(row: T) => string} idOf
 * @param {Direction} direction
 * @returns {(a: T, b: T) => number}
 */
export function keysetComparator(atOf, idOf, direction) {
	const sign = direction === 'newer' ? -1 : 1;
	return (a, b) => {
		const byAt = atOf(b) - atOf(a);
		if (byAt !== 0) return sign * byAt;
		const [idA, idB] = [idOf(a), idOf(b)];
		return sign * (idA < idB ? 1 : idA > idB ? -1 : 0);
	};
}
