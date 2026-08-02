import { serializePlaylistRows } from '#lib/server/playlists';
import { serializeTrackRows } from '#lib/server/tracks';

/**
 * Serialize a mixed page of track + playlist timeline rows, preserving order.
 *
 * @param {import('#lib/server/tracks').ProfileItemRow[]} rows
 * @param {{ id: string } | null | undefined} viewer
 */
export async function serializeTimelineRows(rows, viewer) {
	/** @type {import('#lib/server/tracks').ProfileTrackRow[]} */
	const trackRows = [];
	/** @type {import('#lib/server/tracks').ProfilePlaylistRow[]} */
	const playlistRows = [];

	for (const row of rows) {
		if (row.kind === 'playlist') playlistRows.push(row);
		else trackRows.push(row);
	}

	const [tracks, playlists] = await Promise.all([
		serializeTrackRows(trackRows, viewer),
		serializePlaylistRows(playlistRows, viewer)
	]);

	/** @type {Map<string, (typeof tracks)[number] | (typeof playlists)[number]>} */
	const byId = new Map();
	for (const item of tracks) byId.set(item.id, item);
	for (const item of playlists) byId.set(item.id, item);

	return rows
		.map((row) => byId.get(row.kind === 'playlist' ? row.playlist.id : row.track.id))
		.filter(Boolean);
}
