import {
	parseStreamQuery,
	streamDateBounds,
	streamQueryActive,
	streamQueryKey
} from '#lib/builder/stream-query.js';
import { listingHostOwnerId } from '#lib/server/platform-pool';
import { listStreamTracks, serializeTrackRows } from '#lib/server/tracks';

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

	/** @type {Record<string, { key: string, items: Awaited<ReturnType<typeof serializeTrackRows>>, nextCursor: string | null }>} */
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
				items: await serializeTrackRows(page.rows, locals.user),
				nextCursor: page.nextCursor
			};
		})
	);
	return out;
}
