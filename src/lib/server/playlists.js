import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';

import {
	decodeCursor,
	encodeCursor,
	keysetCondition,
	keysetOrder,
	keysetPage
} from '#lib/server/cursor';
import { db } from '#lib/server/db';
import { playlist, playlistLike, playlistTrack, profile, track, user } from '#lib/server/db/schema';
import {
	getSocialForTracks,
	listTimedCommentsForTracks,
	serializeTrackForPlayer
} from '#lib/server/tracks';

export const PLAYLIST_PAGE_SIZE = 24;
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 5000;

/**
 * @param {FormDataEntryValue | null} value
 */
function trimOrNull(value) {
	const raw = value?.toString().trim() ?? '';
	return raw || null;
}

/**
 * @param {FormData} formData
 */
export function parsePlaylistMetadata(formData) {
	const title = formData.get('title')?.toString().trim() ?? '';
	if (!title) return { ok: false, message: 'Title is required.' };
	if (title.length > TITLE_MAX) {
		return { ok: false, message: `Title must be ${TITLE_MAX} characters or fewer.` };
	}

	const description = trimOrNull(formData.get('description'));
	if (description && description.length > DESCRIPTION_MAX) {
		return { ok: false, message: `Description must be ${DESCRIPTION_MAX} characters or fewer.` };
	}

	const publishedRaw = formData.get('published')?.toString();
	const published = publishedRaw === 'true' || publishedRaw === 'on' || publishedRaw === '1';

	return { ok: true, title, description, published };
}

/**
 * @param {string} userId
 * @param {string} playlistId
 */
export async function getOwnedPlaylist(userId, playlistId) {
	const rows = await db
		.select()
		.from(playlist)
		.where(and(eq(playlist.id, playlistId), eq(playlist.userId, userId)))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * @param {string} playlistId
 */
export async function getPlaylistById(playlistId) {
	const rows = await db.select().from(playlist).where(eq(playlist.id, playlistId)).limit(1);
	return rows[0] ?? null;
}

/**
 * @param {typeof playlist.$inferSelect} row
 * @param {string | null | undefined} viewerId
 */
export function canViewPlaylist(row, viewerId) {
	return row.published || row.userId === viewerId;
}

/**
 * @param {string} playlistId
 */
export async function getPlaylistWithOwner(playlistId) {
	const rows = await db
		.select({
			playlist: playlist,
			username: profile.username,
			uploaderName: user.name
		})
		.from(playlist)
		.leftJoin(profile, eq(profile.userId, playlist.userId))
		.leftJoin(user, eq(user.id, playlist.userId))
		.where(eq(playlist.id, playlistId))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * Ordered published member tracks with uploader info.
 * @param {string} playlistId
 */
export async function listPlaylistTrackRows(playlistId) {
	return db
		.select({
			track: track,
			username: profile.username,
			uploaderName: user.name,
			position: playlistTrack.position
		})
		.from(playlistTrack)
		.innerJoin(track, eq(track.id, playlistTrack.trackId))
		.leftJoin(profile, eq(profile.userId, track.userId))
		.leftJoin(user, eq(user.id, track.userId))
		.where(and(eq(playlistTrack.playlistId, playlistId), eq(track.published, true)))
		.orderBy(asc(playlistTrack.position));
}

/**
 * @typedef {Object} PlaylistSocial
 * @property {number} likeCount
 * @property {boolean} likedByViewer
 */

/**
 * @param {string[]} playlistIds
 * @param {string | null} viewerId
 * @returns {Promise<Map<string, PlaylistSocial>>}
 */
export async function getSocialForPlaylists(playlistIds, viewerId) {
	/** @type {Map<string, PlaylistSocial>} */
	const map = new Map();
	if (playlistIds.length === 0) return map;

	for (const id of playlistIds) {
		map.set(id, { likeCount: 0, likedByViewer: false });
	}

	const likeCounts = await db
		.select({ playlistId: playlistLike.playlistId, n: count() })
		.from(playlistLike)
		.where(inArray(playlistLike.playlistId, playlistIds))
		.groupBy(playlistLike.playlistId);
	for (const row of likeCounts) {
		const entry = map.get(row.playlistId);
		if (entry) entry.likeCount = row.n;
	}

	if (viewerId) {
		const likedRows = await db
			.select({ playlistId: playlistLike.playlistId })
			.from(playlistLike)
			.where(and(inArray(playlistLike.playlistId, playlistIds), eq(playlistLike.userId, viewerId)));
		for (const row of likedRows) {
			const entry = map.get(row.playlistId);
			if (entry) entry.likedByViewer = true;
		}
	}

	return map;
}

/**
 * @param {string} userId
 * @param {string} playlistId
 */
export async function togglePlaylistLike(userId, playlistId) {
	const row = await getPlaylistById(playlistId);
	if (!row || !canViewPlaylist(row, userId)) {
		return { ok: false, message: 'Playlist not found' };
	}

	const existing = await db
		.select({ playlistId: playlistLike.playlistId })
		.from(playlistLike)
		.where(and(eq(playlistLike.playlistId, playlistId), eq(playlistLike.userId, userId)))
		.limit(1);

	let liked;
	if (existing.length > 0) {
		await db
			.delete(playlistLike)
			.where(and(eq(playlistLike.playlistId, playlistId), eq(playlistLike.userId, userId)));
		liked = false;
	} else {
		await db.insert(playlistLike).values({ playlistId, userId });
		liked = true;
	}

	const [{ n: likeCount }] = await db
		.select({ n: count() })
		.from(playlistLike)
		.where(eq(playlistLike.playlistId, playlistId));

	return { ok: true, liked, likeCount };
}

/**
 * @param {string} userId
 * @param {FormData} formData
 */
export async function createPlaylistFromForm(userId, formData) {
	const meta = parsePlaylistMetadata(formData);
	if (!meta.ok) return meta;

	const id = crypto.randomUUID();
	await db.insert(playlist).values({
		id,
		userId,
		title: meta.title,
		description: meta.description,
		published: meta.published
	});

	return { ok: true, playlistId: id };
}

/**
 * @param {string} userId
 * @param {string} playlistId
 * @param {FormData} formData
 */
export async function updatePlaylistFromForm(userId, playlistId, formData) {
	const owned = await getOwnedPlaylist(userId, playlistId);
	if (!owned) return { ok: false, message: 'Playlist not found' };

	const meta = parsePlaylistMetadata(formData);
	if (!meta.ok) return meta;

	await db
		.update(playlist)
		.set({
			title: meta.title,
			description: meta.description,
			published: meta.published
		})
		.where(eq(playlist.id, playlistId));

	return { ok: true };
}

/**
 * @param {string} userId
 * @param {string} playlistId
 */
export async function deletePlaylistForUser(userId, playlistId) {
	const owned = await getOwnedPlaylist(userId, playlistId);
	if (!owned) return { ok: false, message: 'Playlist not found' };

	await db.delete(playlist).where(eq(playlist.id, playlistId));
	return { ok: true };
}

/**
 * @param {string} userId
 * @param {string} playlistId
 * @param {string} trackId
 */
export async function addTrackToPlaylist(userId, playlistId, trackId) {
	const owned = await getOwnedPlaylist(userId, playlistId);
	if (!owned) return { ok: false, message: 'Playlist not found' };

	const trackRows = await db
		.select()
		.from(track)
		.where(and(eq(track.id, trackId), eq(track.published, true)))
		.limit(1);
	const member = trackRows[0] ?? null;
	if (!member) return { ok: false, message: 'Only published tracks can be added to a playlist.' };

	const existing = await db
		.select({ trackId: playlistTrack.trackId })
		.from(playlistTrack)
		.where(and(eq(playlistTrack.playlistId, playlistId), eq(playlistTrack.trackId, trackId)))
		.limit(1);
	if (existing.length > 0) return { ok: false, message: 'That track is already in this playlist.' };

	const last = await db
		.select({ position: playlistTrack.position })
		.from(playlistTrack)
		.where(eq(playlistTrack.playlistId, playlistId))
		.orderBy(desc(playlistTrack.position))
		.limit(1);

	await db.insert(playlistTrack).values({
		playlistId,
		trackId,
		position: (last[0]?.position ?? -1) + 1
	});

	return { ok: true };
}

/**
 * @param {string} userId
 * @param {string} playlistId
 * @param {string} trackId
 */
export async function removeTrackFromPlaylist(userId, playlistId, trackId) {
	const owned = await getOwnedPlaylist(userId, playlistId);
	if (!owned) return { ok: false, message: 'Playlist not found' };

	await db
		.delete(playlistTrack)
		.where(and(eq(playlistTrack.playlistId, playlistId), eq(playlistTrack.trackId, trackId)));

	const remaining = await db
		.select({ trackId: playlistTrack.trackId })
		.from(playlistTrack)
		.where(eq(playlistTrack.playlistId, playlistId))
		.orderBy(asc(playlistTrack.position));

	for (let i = 0; i < remaining.length; i++) {
		await db
			.update(playlistTrack)
			.set({ position: i })
			.where(
				and(
					eq(playlistTrack.playlistId, playlistId),
					eq(playlistTrack.trackId, remaining[i].trackId)
				)
			);
	}

	return { ok: true };
}

/**
 * Replace membership order. `trackIds` must be the full current set.
 * @param {string} userId
 * @param {string} playlistId
 * @param {string[]} trackIds
 */
export async function reorderPlaylistTracks(userId, playlistId, trackIds) {
	const owned = await getOwnedPlaylist(userId, playlistId);
	if (!owned) return { ok: false, message: 'Playlist not found' };

	if (!Array.isArray(trackIds)) {
		return { ok: false, message: 'trackIds must be an array.' };
	}

	const current = await db
		.select({ trackId: playlistTrack.trackId })
		.from(playlistTrack)
		.where(eq(playlistTrack.playlistId, playlistId));
	const currentSet = new Set(current.map((row) => row.trackId));
	const nextSet = new Set(trackIds);

	if (currentSet.size !== nextSet.size || trackIds.some((id) => !currentSet.has(id))) {
		return { ok: false, message: 'trackIds must match the playlist membership exactly.' };
	}
	if (new Set(trackIds).size !== trackIds.length) {
		return { ok: false, message: 'trackIds must not contain duplicates.' };
	}

	for (let i = 0; i < trackIds.length; i++) {
		await db
			.update(playlistTrack)
			.set({ position: i })
			.where(and(eq(playlistTrack.playlistId, playlistId), eq(playlistTrack.trackId, trackIds[i])));
	}

	return { ok: true };
}

/**
 * Compact picker rows for the signed-in owner's playlists.
 * @param {string} userId
 */
export async function listPlaylistsForOwner(userId) {
	const rows = await db
		.select({
			id: playlist.id,
			title: playlist.title,
			published: playlist.published,
			createdAt: playlist.createdAt
		})
		.from(playlist)
		.where(eq(playlist.userId, userId))
		.orderBy(desc(playlist.createdAt));

	if (rows.length === 0) return [];

	const counts = await db
		.select({
			playlistId: playlistTrack.playlistId,
			n: count()
		})
		.from(playlistTrack)
		.where(
			inArray(
				playlistTrack.playlistId,
				rows.map((row) => row.id)
			)
		)
		.groupBy(playlistTrack.playlistId);

	/** @type {Map<string, number>} */
	const countById = new Map(counts.map((row) => [row.playlistId, row.n]));

	return rows.map((row) => ({
		id: row.id,
		title: row.title,
		published: Boolean(row.published),
		createdAt: row.createdAt?.getTime() ?? Date.now(),
		trackCount: countById.get(row.id) ?? 0
	}));
}

/**
 * Keyset page of playlists for timeline merges.
 *
 * @param {{
 *   userIds?: string[] | null,
 *   publishedOnly?: boolean,
 *   limit?: number,
 *   cursor?: string | null,
 *   direction?: import('#lib/server/cursor').Direction,
 *   inclusive?: boolean
 * }} [opts]
 */
export async function listPlaylistRows({
	userIds = null,
	publishedOnly = true,
	limit = PLAYLIST_PAGE_SIZE,
	cursor = null,
	direction = 'older',
	inclusive = false
} = {}) {
	if (userIds && userIds.length === 0) {
		return { rows: [], nextCursor: null };
	}

	const decoded = cursor ? decodeCursor(cursor) : null;

	/** @type {import('drizzle-orm').SQL[]} */
	const conditions = [];
	if (publishedOnly) conditions.push(eq(playlist.published, true));
	if (userIds) conditions.push(inArray(playlist.userId, userIds));
	if (decoded) {
		conditions.push(
			keysetCondition(playlist.createdAt, playlist.id, decoded, direction, inclusive)
		);
	}

	const rows = await db
		.select({
			playlist: playlist,
			username: profile.username,
			uploaderName: user.name
		})
		.from(playlist)
		.leftJoin(profile, eq(profile.userId, playlist.userId))
		.leftJoin(user, eq(user.id, playlist.userId))
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(...keysetOrder(playlist.createdAt, playlist.id, direction))
		.limit(limit + 1);

	return keysetPage(
		rows,
		limit,
		(row) => encodeCursor(row.playlist.createdAt ?? Date.now(), row.playlist.id),
		direction
	);
}

/**
 * Serialize one playlist (+ members) for card / detail UIs.
 *
 * @param {typeof playlist.$inferSelect} row
 * @param {{ username: string | null, uploaderName: string | null }} owner
 * @param {PlaylistSocial | undefined} social
 * @param {{ id: string } | null | undefined} viewer
 * @param {number} [createdAtOverride] ms used for the listing cursor when merging timelines
 */
export async function serializePlaylistForCard(row, owner, social, viewer, createdAtOverride) {
	const memberRows = await listPlaylistTrackRows(row.id);
	const trackIds = memberRows.map((m) => m.track.id);
	const [trackSocial, timedComments] = await Promise.all([
		getSocialForTracks(trackIds, viewer?.id ?? null),
		listTimedCommentsForTracks(trackIds)
	]);

	const tracks = await Promise.all(
		memberRows.map((m) =>
			serializeTrackForPlayer(
				m.track,
				m,
				trackSocial.get(m.track.id),
				viewer,
				timedComments.get(m.track.id)
			)
		)
	);

	const createdAt = createdAtOverride ?? row.createdAt?.getTime() ?? Date.now();
	const durationMs = tracks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);
	const firstCover = tracks.find((t) => t.hasCover);

	return {
		kind: /** @type {const} */ ('playlist'),
		id: row.id,
		title: row.title,
		description: row.description,
		published: Boolean(row.published),
		hasCover: Boolean(row.coverFilename) || Boolean(firstCover),
		/** Track id whose cover to show when the playlist has no own cover. */
		coverTrackId: row.coverFilename ? null : (firstCover?.id ?? null),
		createdAt,
		cursor: encodeCursor(createdAt, row.id),
		username: owner.username,
		uploaderName: owner.uploaderName ?? owner.username ?? 'Unknown',
		isOwner: Boolean(viewer && viewer.id === row.userId),
		likeCount: social?.likeCount ?? 0,
		likedByViewer: social?.likedByViewer ?? false,
		trackCount: tracks.length,
		durationMs,
		tracks
	};
}

/**
 * @param {Array<{
 *   playlist: typeof playlist.$inferSelect,
 *   username: string | null,
 *   uploaderName: string | null
 * }>} rows
 * @param {{ id: string } | null | undefined} viewer
 */
export async function serializePlaylistRows(rows, viewer) {
	const playlistIds = rows.map((row) => row.playlist.id);
	const social = await getSocialForPlaylists(playlistIds, viewer?.id ?? null);

	return Promise.all(
		rows.map((row) =>
			serializePlaylistForCard(row.playlist, row, social.get(row.playlist.id), viewer)
		)
	);
}
