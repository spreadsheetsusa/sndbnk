import {
	parseStreamChrome,
	parseStreamQuery,
	streamDateBounds,
	streamFacetKey,
	streamQueryActive,
	streamQueryKey
} from '#lib/builder/stream-query.js';
import { listingHostOwnerId } from '#lib/server/platform-pool';
import { serializeTimelineRows } from '#lib/server/timeline';
import { listStreamFacets, listStreamTracks } from '#lib/server/tracks';

/**
 * First page for each stream block that has a catalog query, keyed by block id.
 * Unfiltered streams keep using the shared profile timeline.
 *
 * @param {string} userId
 * @param {Array<{ id: string, type: string, hidden?: boolean, props: Record<string, unknown> }>} blocks
 * @param {App.Locals} locals
 */
export async function loadStreamSeeds(userId, blocks, locals) {
	const targets = blocks.filter(
		(block) =>
			block.type === 'catalog.stream' &&
			block.hidden !== true &&
			streamQueryActive(parseStreamQuery(block.props))
	);
	const hostOwnerId = listingHostOwnerId(locals, userId);

	/** @type {Record<string, { key: string, items: Awaited<ReturnType<typeof serializeTimelineRows>>, nextCursor: string | null }>} */
	const out = {};
	await Promise.all(
		targets.map(async (block) => {
			const query = parseStreamQuery(block.props);
			const bounds = streamDateBounds(query);
			const page = await listStreamTracks(userId, {
				hostOwnerId,
				mediaType: query.mediaType,
				genre: query.genre,
				artists: query.artists,
				dateFromMs: bounds.from,
				dateToMs: bounds.to,
				count: query.count
			});
			out[block.id] = {
				key: streamQueryKey(query),
				items: await serializeTimelineRows(page.rows, locals.user, hostOwnerId),
				nextCursor: page.nextCursor
			};
		})
	);
	return out;
}

/**
 * Sidebar catalogs for stream blocks that opted into one.
 * Keyed by block id. Search-only blocks do not need this payload.
 *
 * @param {string} userId
 * @param {Array<{ id: string, type: string, hidden?: boolean, props: Record<string, unknown> }>} blocks
 * @param {App.Locals} locals
 */
export async function loadStreamFacets(userId, blocks, locals) {
	const targets = blocks.filter(
		(block) =>
			block.type === 'catalog.stream' &&
			block.hidden !== true &&
			parseStreamChrome(block.props).showSidebar
	);
	const hostOwnerId = listingHostOwnerId(locals, userId);

	/** @type {Record<string, { key: string } & Awaited<ReturnType<typeof listStreamFacets>>>} */
	const out = {};
	await Promise.all(
		targets.map(async (block) => {
			const query = parseStreamQuery(block.props);
			const bounds = streamDateBounds(query);
			const facets = await listStreamFacets(userId, {
				hostOwnerId,
				mediaType: query.mediaType,
				genre: query.genre,
				artists: query.artists,
				dateFromMs: bounds.from,
				dateToMs: bounds.to
			});
			out[block.id] = { key: streamFacetKey(query), ...facets };
		})
	);
	return out;
}
