import { and, asc, count, desc, eq, inArray, isNotNull } from 'drizzle-orm';

import { DEFAULT_TRACK_MEDIA_TYPE, isTrackMediaType } from '#lib/media/track-media-type.js';
import {
	decodeCursor,
	encodeCursor,
	keysetComparator,
	keysetCondition,
	keysetOrder,
	keysetPage
} from '#lib/server/cursor';
import { db } from '#lib/server/db';
import { profile, track, trackComment, trackLike, trackRepost, user } from '#lib/server/db/schema';
import { readFileHead, sniffAudio, sniffImage } from '#lib/server/media/sniff';
import { parseWaveform } from '#lib/server/media/waveform';
import { checkUploadAllowed } from '#lib/server/quota';
import { enqueueWaveformJob } from '#lib/server/queue/waveform';
import { getOrCreateStorageSetting, getStorageAdapter } from '#lib/server/storage';

const AUDIO_MAX_BYTES = 500 * 1024 * 1024;
const COVER_MAX_BYTES = 5 * 1024 * 1024;

export const TRACK_PAGE_SIZE = 24;

/** @type {Record<string, string>} */
const AUDIO_EXT_BY_MIME = {
	'audio/mpeg': 'mp3',
	'audio/mp3': 'mp3',
	'audio/wav': 'wav',
	'audio/x-wav': 'wav',
	'audio/wave': 'wav',
	'audio/flac': 'flac',
	'audio/x-flac': 'flac',
	'audio/aac': 'aac',
	'audio/ogg': 'ogg',
	'audio/mp4': 'm4a',
	'audio/x-m4a': 'm4a'
};

/** @type {Record<string, string>} */
const COVER_EXT_BY_MIME = {
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

/**
 * @param {string} filename
 */
function extFromName(filename) {
	const idx = filename.lastIndexOf('.');
	if (idx < 0) return '';
	return filename.slice(idx + 1).toLowerCase();
}

/**
 * @param {FormDataEntryValue | null} value
 * @returns {value is File}
 */
function isFile(value) {
	return typeof File !== 'undefined' && value instanceof File && value.size > 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Coerce a form value to an integer in range, or null if missing/invalid.
 * Invalid values are dropped silently (descriptive metadata, not a hard fail).
 * @param {FormDataEntryValue | null} value
 * @param {number} min
 * @param {number} max
 * @returns {number | null}
 */
function optionalBoundedInt(value, min, max) {
	const raw = value?.toString().trim() ?? '';
	if (!raw) return null;
	const n = Number.parseInt(raw, 10);
	if (!Number.isInteger(n) || n < min || n > max) return null;
	return n;
}

/**
 * @param {FormData} formData
 */
export function parseTrackMetadata(formData) {
	const title = formData.get('title')?.toString().trim() ?? '';
	const description = formData.get('description')?.toString().trim() || null;
	const artist = formData.get('artist')?.toString().trim() || null;
	const album = formData.get('album')?.toString().trim() || null;
	const genre = formData.get('genre')?.toString().trim() || null;
	const mediaTypeRaw = formData.get('mediaType')?.toString().trim() || DEFAULT_TRACK_MEDIA_TYPE;
	const isrc = formData.get('isrc')?.toString().trim() || null;
	const comment = formData.get('comment')?.toString().trim() || null;

	if (!isTrackMediaType(mediaTypeRaw)) {
		return { ok: false, message: 'Media type must be track, mix, sample, loop, or podcast.' };
	}
	const mediaType = mediaTypeRaw;

	const yearRaw = formData.get('year')?.toString().trim() ?? '';
	const trackNumberRaw = formData.get('trackNumber')?.toString().trim() ?? '';
	const bpmRaw = formData.get('bpm')?.toString().trim() ?? '';

	/** @type {number | null} */
	let year = null;
	/** @type {number | null} */
	let trackNumber = null;
	/** @type {number | null} */
	let bpm = null;

	if (yearRaw) {
		year = Number.parseInt(yearRaw, 10);
		if (!Number.isInteger(year) || year < 1000 || year > 9999) {
			return { ok: false, message: 'Year must be a 4-digit number.' };
		}
	}

	if (trackNumberRaw) {
		trackNumber = Number.parseInt(trackNumberRaw, 10);
		if (!Number.isInteger(trackNumber) || trackNumber < 1 || trackNumber > 9999) {
			return { ok: false, message: 'Track number must be a positive integer.' };
		}
	}

	if (bpmRaw) {
		bpm = Number.parseInt(bpmRaw, 10);
		if (!Number.isInteger(bpm) || bpm < 1 || bpm > 999) {
			return { ok: false, message: 'BPM must be between 1 and 999.' };
		}
	}

	if (!title) {
		return { ok: false, message: 'Title is required.' };
	}

	if (title.length > 200) {
		return { ok: false, message: 'Title must be 200 characters or fewer.' };
	}

	const capped = (value, max, label) => {
		if (value == null) return { ok: true, value: null };
		if (value.length > max) {
			return { ok: false, message: `${label} must be ${max} characters or fewer.` };
		}
		return { ok: true, value };
	};

	const descriptionCap = capped(description, 5000, 'Description');
	if (!descriptionCap.ok) return descriptionCap;
	const artistCap = capped(artist, 200, 'Artist');
	if (!artistCap.ok) return artistCap;
	const albumCap = capped(album, 200, 'Album');
	if (!albumCap.ok) return albumCap;
	const genreCap = capped(genre, 100, 'Genre');
	if (!genreCap.ok) return genreCap;
	const commentCap = capped(comment, 2000, 'Comment');
	if (!commentCap.ok) return commentCap;
	const isrcCap = capped(isrc, 20, 'ISRC');
	if (!isrcCap.ok) return isrcCap;
	if (isrcCap.value && !/^[A-Z0-9-]+$/i.test(isrcCap.value)) {
		return { ok: false, message: 'ISRC looks invalid.' };
	}

	const durationMs = optionalBoundedInt(formData.get('durationMs'), 0, DAY_MS);
	const bitrate = optionalBoundedInt(formData.get('bitrate'), 0, 10_000_000);
	const sampleRate = optionalBoundedInt(formData.get('sampleRate'), 0, 768_000);
	const channels = optionalBoundedInt(formData.get('channels'), 1, 32);

	const codecRaw = formData.get('codec')?.toString().trim() ?? '';
	const codec = codecRaw ? codecRaw.slice(0, 40) : null;

	return {
		ok: true,
		metadata: {
			title,
			description: descriptionCap.value,
			artist: artistCap.value,
			album: albumCap.value,
			genre: genreCap.value,
			mediaType,
			year,
			trackNumber,
			bpm,
			isrc: isrcCap.value,
			comment: commentCap.value,
			durationMs,
			bitrate,
			sampleRate,
			channels,
			codec
		}
	};
}

/**
 * @param {File} file
 */
export async function validateAudioFile(file) {
	if (file.size > AUDIO_MAX_BYTES) {
		return { ok: false, message: 'Audio must be 500MB or smaller.' };
	}

	const head = await readFileHead(file);
	const sniffed = sniffAudio(head);
	if (!sniffed) {
		return {
			ok: false,
			message: 'Audio must be mp3, wav, flac, aac, ogg, or m4a.'
		};
	}

	// Extension hint may refine AAC vs M4A when magic is ambiguous; never trust MIME alone.
	const extHint = extFromName(file.name);
	let resolvedExt = sniffed.ext;
	if (sniffed.ext === 'm4a' && extHint === 'aac') resolvedExt = 'aac';
	if (sniffed.ext === 'mp3' && AUDIO_EXT_BY_MIME[(file.type || '').toLowerCase()] === 'mp3') {
		resolvedExt = 'mp3';
	}

	return {
		ok: true,
		filename: `audio.${resolvedExt}`,
		mime: sniffed.mime,
		bytes: file.size
	};
}

/**
 * @param {File} file
 */
export async function validateCoverFile(file) {
	if (file.size > COVER_MAX_BYTES) {
		return { ok: false, message: 'Cover art must be 5MB or smaller.' };
	}

	const head = await readFileHead(file);
	const sniffed = sniffImage(head);
	if (!sniffed || !COVER_EXT_BY_MIME[sniffed.mime]) {
		return { ok: false, message: 'Cover art must be jpg, png, webp, or gif.' };
	}

	return {
		ok: true,
		filename: `cover.${sniffed.ext}`,
		mime: sniffed.mime,
		bytes: file.size
	};
}

/**
 * @param {string} userId
 * @param {string} trackId
 */
export async function getOwnedTrack(userId, trackId) {
	const rows = await db
		.select()
		.from(track)
		.where(and(eq(track.id, trackId), eq(track.userId, userId)))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * @param {string} userId
 * @param {FormData} formData
 */
export async function createTrackFromForm(userId, formData) {
	const metaResult = parseTrackMetadata(formData);
	if (!metaResult.ok) return metaResult;

	const audioEntry = formData.get('audio');
	if (!isFile(audioEntry)) {
		return { ok: false, message: 'Choose an audio file to upload.' };
	}

	const audioResult = await validateAudioFile(audioEntry);
	if (!audioResult.ok) return audioResult;

	const coverEntry = formData.get('cover');
	/** @type {{ filename: string, mime: string, bytes: number } | null} */
	let coverResult = null;
	if (isFile(coverEntry)) {
		const validated = await validateCoverFile(coverEntry);
		if (!validated.ok) return validated;
		coverResult = validated;
	}

	const setting = await getOrCreateStorageSetting(userId);
	const adapterId = /** @type {'local' | 'ssh'} */ (setting.adapter === 'ssh' ? 'ssh' : 'local');

	const quota = await checkUploadAllowed(userId, {
		newTrack: true,
		addedBytes: audioResult.bytes + (coverResult?.bytes ?? 0),
		adapter: adapterId
	});
	if (!quota.ok) return quota;

	let storage;
	try {
		storage = await getStorageAdapter(userId, adapterId);
	} catch (err) {
		return {
			ok: false,
			message:
				err instanceof Error ? err.message : 'Storage is not configured. Check Settings → Storage.'
		};
	}

	const id = crypto.randomUUID();
	const folderKey = id;
	const now = new Date();

	const audioBytes = new Uint8Array(await audioEntry.arrayBuffer());

	await db.insert(track).values({
		id,
		userId,
		...metaResult.metadata,
		audioFilename: audioResult.filename,
		audioMime: audioResult.mime,
		audioBytes: audioResult.bytes,
		coverFilename: coverResult?.filename ?? null,
		coverMime: coverResult?.mime ?? null,
		coverBytes: coverResult?.bytes ?? null,
		waveform: null,
		published: true,
		storageAdapter: adapterId,
		folderKey,
		createdAt: now,
		updatedAt: now
	});

	try {
		await storage.put(folderKey, audioResult.filename, audioBytes, audioResult.mime);

		if (coverResult && isFile(coverEntry)) {
			const coverBytes = new Uint8Array(await coverEntry.arrayBuffer());
			await storage.put(folderKey, coverResult.filename, coverBytes, coverResult.mime);
		}
	} catch (err) {
		try {
			await storage.delete(folderKey);
		} catch {
			// ignore cleanup errors
		}
		await db.delete(track).where(eq(track.id, id));
		return {
			ok: false,
			message: err instanceof Error ? err.message : 'Upload failed. Try again.'
		};
	}

	// Peaks are generated asynchronously by the waveform worker (BullMQ).
	await enqueueWaveformJob(id);

	return { ok: true, trackId: id };
}

/**
 * @param {string} userId
 * @param {string} trackId
 * @param {FormData} formData
 */
export async function updateTrackFromForm(userId, trackId, formData) {
	const existing = await getOwnedTrack(userId, trackId);
	if (!existing) {
		return { ok: false, message: 'Track not found.' };
	}

	const metaResult = parseTrackMetadata(formData);
	if (!metaResult.ok) return metaResult;

	/** @type {Record<string, unknown>} */
	const patch = {
		...metaResult.metadata,
		updatedAt: new Date()
	};

	const audioEntry = formData.get('audio');
	const coverEntry = formData.get('cover');
	const replaceAudio = isFile(audioEntry);
	const replaceCover = isFile(coverEntry);

	/** @type {{ filename: string, mime: string, bytes: number } | null} */
	let audioResult = null;
	/** @type {{ filename: string, mime: string, bytes: number } | null} */
	let coverResult = null;

	if (replaceAudio) {
		const validated = await validateAudioFile(/** @type {File} */ (audioEntry));
		if (!validated.ok) return validated;
		audioResult = validated;
		patch.audioFilename = validated.filename;
		patch.audioMime = validated.mime;
		patch.audioBytes = validated.bytes;
	}

	if (replaceCover) {
		const validated = await validateCoverFile(/** @type {File} */ (coverEntry));
		if (!validated.ok) return validated;
		coverResult = validated;
		patch.coverFilename = validated.filename;
		patch.coverMime = validated.mime;
		patch.coverBytes = validated.bytes;
	}

	if (audioResult || coverResult) {
		const quota = await checkUploadAllowed(userId, {
			newTrack: false,
			addedBytes: (audioResult?.bytes ?? 0) + (coverResult?.bytes ?? 0),
			adapter: existing.storageAdapter,
			replacesBytes:
				(audioResult ? existing.audioBytes : 0) + (coverResult ? (existing.coverBytes ?? 0) : 0)
		});
		if (!quota.ok) return quota;
	}

	if (replaceAudio || replaceCover) {
		let storage;
		try {
			storage = await getStorageAdapter(
				userId,
				/** @type {'local' | 'ssh'} */ (existing.storageAdapter)
			);
		} catch (err) {
			return {
				ok: false,
				message: err instanceof Error ? err.message : 'Storage is not available.'
			};
		}

		try {
			if (audioResult && isFile(audioEntry)) {
				const bytes = new Uint8Array(await audioEntry.arrayBuffer());
				await storage.put(existing.folderKey, audioResult.filename, bytes, audioResult.mime);
				// Clear peaks until the worker regenerates them for the new audio.
				patch.waveform = null;
				if (existing.audioFilename !== audioResult.filename) {
					// Best-effort: leave old file; folder delete on track delete cleans up.
				}
			}
			if (coverResult && isFile(coverEntry)) {
				const bytes = new Uint8Array(await coverEntry.arrayBuffer());
				await storage.put(existing.folderKey, coverResult.filename, bytes, coverResult.mime);
			}
		} catch (err) {
			return {
				ok: false,
				message: err instanceof Error ? err.message : 'Could not replace media file.'
			};
		}
	}

	await db
		.update(track)
		.set(patch)
		.where(and(eq(track.id, trackId), eq(track.userId, userId)));

	if (replaceAudio) {
		await enqueueWaveformJob(trackId);
	}

	return { ok: true };
}

/**
 * @param {string} userId
 * @param {string} trackId
 * @param {boolean} published
 */
export async function setTrackPublished(userId, trackId, published) {
	const existing = await getOwnedTrack(userId, trackId);
	if (!existing) {
		return { ok: false, message: 'Track not found.' };
	}

	await db
		.update(track)
		.set({ published, updatedAt: new Date() })
		.where(and(eq(track.id, trackId), eq(track.userId, userId)));

	return { ok: true, published };
}

/**
 * @param {string} userId
 * @param {string} trackId
 */
export async function deleteTrackForUser(userId, trackId) {
	const existing = await getOwnedTrack(userId, trackId);
	if (!existing) {
		return { ok: false, message: 'Track not found.' };
	}

	try {
		const storage = await getStorageAdapter(
			userId,
			/** @type {'local' | 'ssh'} */ (existing.storageAdapter)
		);
		await storage.delete(existing.folderKey);
	} catch {
		// Still remove DB row if storage cleanup fails (orphan files possible).
	}

	await db.delete(track).where(and(eq(track.id, trackId), eq(track.userId, userId)));
	return { ok: true };
}

/**
 * Fetch a track by id regardless of viewer (public playback surfaces).
 * @param {string} trackId
 */
export async function getTrackById(trackId) {
	const rows = await db.select().from(track).where(eq(track.id, trackId)).limit(1);
	return rows[0] ?? null;
}

/**
 * Unpublished tracks stay reachable for their owner (library playback, edit page)
 * and read as missing to everyone else.
 * @param {typeof track.$inferSelect} row
 * @param {string | null | undefined} viewerId
 */
export function canViewTrack(row, viewerId) {
	return row.published || row.userId === viewerId;
}

/**
 * Return stored waveform peaks, or enqueue a backfill job when missing.
 * Never runs ffmpeg on the request path — long mixes would block the HTTP
 * process. Callers see placeholder bars until the worker finishes.
 *
 * @param {typeof track.$inferSelect} row
 * @returns {Promise<number[] | null>}
 */
export async function ensureTrackWaveform(row) {
	const existing = parseWaveform(row.waveform);
	if (existing) return existing;
	await enqueueWaveformJob(row.id);
	return null;
}

/**
 * @typedef {Object} TrackSocial
 * @property {number} likeCount
 * @property {number} commentCount
 * @property {number} repostCount
 * @property {boolean} likedByViewer
 * @property {boolean} repostedByViewer
 */

/**
 * Like/comment/repost counts and viewer state for a set of tracks.
 * @param {string[]} trackIds
 * @param {string | null} viewerId
 * @returns {Promise<Map<string, TrackSocial>>}
 */
export async function getSocialForTracks(trackIds, viewerId) {
	/** @type {Map<string, TrackSocial>} */
	const map = new Map();
	if (trackIds.length === 0) return map;

	for (const id of trackIds) {
		map.set(id, {
			likeCount: 0,
			commentCount: 0,
			repostCount: 0,
			likedByViewer: false,
			repostedByViewer: false
		});
	}

	const likeCounts = await db
		.select({ trackId: trackLike.trackId, n: count() })
		.from(trackLike)
		.where(inArray(trackLike.trackId, trackIds))
		.groupBy(trackLike.trackId);
	for (const row of likeCounts) {
		const entry = map.get(row.trackId);
		if (entry) entry.likeCount = row.n;
	}

	const commentCounts = await db
		.select({ trackId: trackComment.trackId, n: count() })
		.from(trackComment)
		.where(inArray(trackComment.trackId, trackIds))
		.groupBy(trackComment.trackId);
	for (const row of commentCounts) {
		const entry = map.get(row.trackId);
		if (entry) entry.commentCount = row.n;
	}

	const repostCounts = await db
		.select({ trackId: trackRepost.trackId, n: count() })
		.from(trackRepost)
		.where(inArray(trackRepost.trackId, trackIds))
		.groupBy(trackRepost.trackId);
	for (const row of repostCounts) {
		const entry = map.get(row.trackId);
		if (entry) entry.repostCount = row.n;
	}

	if (viewerId) {
		const [likedRows, repostedRows] = await Promise.all([
			db
				.select({ trackId: trackLike.trackId })
				.from(trackLike)
				.where(and(inArray(trackLike.trackId, trackIds), eq(trackLike.userId, viewerId))),
			db
				.select({ trackId: trackRepost.trackId })
				.from(trackRepost)
				.where(and(inArray(trackRepost.trackId, trackIds), eq(trackRepost.userId, viewerId)))
		]);

		for (const row of likedRows) {
			const entry = map.get(row.trackId);
			if (entry) entry.likedByViewer = true;
		}
		for (const row of repostedRows) {
			const entry = map.get(row.trackId);
			if (entry) entry.repostedByViewer = true;
		}
	}

	return map;
}

/**
 * Comments for a track, newest first, with commenter names.
 * @param {string} trackId
 */
export async function listCommentsForTrack(trackId) {
	const rows = await db
		.select({
			id: trackComment.id,
			body: trackComment.body,
			atMs: trackComment.atMs,
			createdAt: trackComment.createdAt,
			userId: trackComment.userId,
			userName: user.name,
			userImage: user.image
		})
		.from(trackComment)
		.leftJoin(user, eq(user.id, trackComment.userId))
		.where(eq(trackComment.trackId, trackId))
		.orderBy(desc(trackComment.createdAt));

	return rows.map((row) => ({
		id: row.id,
		body: row.body,
		atMs: row.atMs,
		createdAt: row.createdAt?.getTime() ?? Date.now(),
		userId: row.userId,
		userName: row.userName ?? 'Unknown',
		userImage: row.userImage ?? null
	}));
}

/**
 * @typedef {Object} TimedComment
 * @property {string} id
 * @property {string} body
 * @property {number} atMs
 * @property {number} createdAt
 * @property {string} userId
 * @property {string} userName
 * @property {string | null} userImage
 */

/**
 * Timestamped comments (`atMs` set) for a set of tracks, oldest position first.
 * Powers the avatar markers drawn on track waveforms.
 *
 * @param {string[]} trackIds
 * @returns {Promise<Map<string, TimedComment[]>>}
 */
export async function listTimedCommentsForTracks(trackIds) {
	/** @type {Map<string, TimedComment[]>} */
	const map = new Map();
	if (trackIds.length === 0) return map;

	for (const id of trackIds) {
		map.set(id, []);
	}

	const rows = await db
		.select({
			id: trackComment.id,
			trackId: trackComment.trackId,
			body: trackComment.body,
			atMs: trackComment.atMs,
			createdAt: trackComment.createdAt,
			userId: trackComment.userId,
			userName: user.name,
			userImage: user.image
		})
		.from(trackComment)
		.leftJoin(user, eq(user.id, trackComment.userId))
		.where(and(inArray(trackComment.trackId, trackIds), isNotNull(trackComment.atMs)))
		.orderBy(asc(trackComment.atMs));

	for (const row of rows) {
		const entry = map.get(row.trackId);
		if (!entry) continue;
		entry.push({
			id: row.id,
			body: row.body,
			atMs: row.atMs ?? 0,
			createdAt: row.createdAt?.getTime() ?? Date.now(),
			userId: row.userId,
			userName: row.userName ?? 'Unknown',
			userImage: row.userImage ?? null
		});
	}

	return map;
}

/**
 * Serialize a track row (+uploader username, +social) for player card UIs.
 * Backfills waveform peaks from stored audio when missing.
 *
 * The `uploader` wrapper is the whole list row, so repost attribution set by
 * feed and profile queries rides along without a separate argument.
 *
 * @param {typeof track.$inferSelect} row
 * @param {{
 *   username: string | null,
 *   uploaderName: string | null,
 *   repostedAt?: number | null,
 *   repostedByName?: string | null,
 *   repostedByUsername?: string | null
 * }} uploader
 * @param {TrackSocial | undefined} social
 * @param {{ id: string } | null | undefined} viewer
 * @param {TimedComment[] | undefined} [timedComments]
 */
export async function serializeTrackForPlayer(row, uploader, social, viewer, timedComments) {
	const waveform = await ensureTrackWaveform(row);

	return {
		kind: /** @type {const} */ ('track'),
		id: row.id,
		title: row.title,
		artist: row.artist,
		genre: row.genre,
		durationMs: row.durationMs,
		bitrate: row.bitrate ?? null,
		sampleRate: row.sampleRate ?? null,
		channels: row.channels ?? null,
		codec: row.codec ?? null,
		hasCover: Boolean(row.coverFilename),
		published: Boolean(row.published),
		createdAt: row.createdAt?.getTime() ?? Date.now(),
		// Position in the paged list, so the client can resume from any item.
		cursor: encodeCursor(uploader.repostedAt ?? row.createdAt ?? Date.now(), row.id),
		username: uploader.username,
		uploaderName: uploaderName(uploader),
		waveform,
		likeCount: social?.likeCount ?? 0,
		commentCount: social?.commentCount ?? 0,
		repostCount: social?.repostCount ?? 0,
		likedByViewer: social?.likedByViewer ?? false,
		repostedByViewer: social?.repostedByViewer ?? false,
		repostedAt: uploader.repostedAt ?? null,
		repostedByName: uploader.repostedByName ?? null,
		repostedByUsername: uploader.repostedByUsername ?? null,
		isOwner: Boolean(viewer && viewer.id === row.userId),
		timedComments: timedComments ?? []
	};
}

/**
 * @param {{ username: string | null, uploaderName: string | null }} uploader
 */
function uploaderName(uploader) {
	return uploader.uploaderName ?? uploader.username ?? 'Unknown';
}

/**
 * Serialize a page of list rows, batching the social and timed-comment lookups
 * across the whole page rather than per track.
 *
 * @param {Array<Parameters<typeof serializeTrackForPlayer>[1] & { track: typeof track.$inferSelect }>} rows
 * @param {{ id: string } | null | undefined} viewer
 */
export async function serializeTrackRows(rows, viewer) {
	const trackIds = rows.map((row) => row.track.id);
	const [social, timedComments] = await Promise.all([
		getSocialForTracks(trackIds, viewer?.id ?? null),
		listTimedCommentsForTracks(trackIds)
	]);

	return Promise.all(
		rows.map((row) =>
			serializeTrackForPlayer(
				row.track,
				row,
				social.get(row.track.id),
				viewer,
				timedComments.get(row.track.id)
			)
		)
	);
}

/**
 * @typedef {{
 *   kind: 'track',
 *   track: typeof track.$inferSelect,
 *   username: string | null,
 *   uploaderName: string | null,
 *   repostedAt: number | null,
 *   repostedByName?: string | null,
 *   repostedByUsername?: string | null
 * }} ProfileTrackRow
 *
 * @typedef {{
 *   kind: 'playlist',
 *   playlist: typeof import('#lib/server/db/schema').playlist.$inferSelect,
 *   username: string | null,
 *   uploaderName: string | null
 * }} ProfilePlaylistRow
 *
 * @typedef {ProfileTrackRow | ProfilePlaylistRow} ProfileItemRow
 */

/**
 * @typedef {{
 *   limit?: number,
 *   cursor?: string | null,
 *   direction?: import('#lib/server/cursor').Direction,
 *   inclusive?: boolean
 * }} PageOptions
 */

/**
 * A repost is placed by when it was reposted, not when it was uploaded.
 * @param {ProfileItemRow} row
 */
function itemSortAt(row) {
	if (row.kind === 'playlist') return row.playlist.createdAt?.getTime() ?? 0;
	return row.repostedAt ?? row.track.createdAt?.getTime() ?? 0;
}

/**
 * @param {ProfileItemRow} row
 */
function itemSortId(row) {
	return row.kind === 'playlist' ? row.playlist.id : row.track.id;
}

/**
 * @param {ProfileItemRow} row
 */
function itemCursor(row) {
	return encodeCursor(itemSortAt(row), itemSortId(row));
}

/**
 * One keyset page of a user's own uploads.
 * @param {string} userId
 * @param {{ publishedOnly?: boolean, decoded: { ms: number, id: string } | null } & Required<Pick<PageOptions, 'limit' | 'direction' | 'inclusive'>>} input
 */
function selectOwnTracks(userId, { publishedOnly, decoded, limit, direction, inclusive }) {
	/** @type {import('drizzle-orm').SQL[]} */
	const conditions = [eq(track.userId, userId)];
	if (publishedOnly) conditions.push(eq(track.published, true));
	if (decoded) {
		conditions.push(keysetCondition(track.createdAt, track.id, decoded, direction, inclusive));
	}

	return db
		.select({
			track: track,
			username: profile.username,
			uploaderName: user.name
		})
		.from(track)
		.leftJoin(profile, eq(profile.userId, track.userId))
		.leftJoin(user, eq(user.id, track.userId))
		.where(and(...conditions))
		.orderBy(...keysetOrder(track.createdAt, track.id, direction))
		.limit(limit + 1);
}

/**
 * Track rows with uploader profile info for a user, newest first.
 * @param {string} userId
 * @param {{ publishedOnly?: boolean } & PageOptions} [options]
 * @returns {Promise<{ rows: ProfileItemRow[], nextCursor: string | null }>}
 */
export async function listTracksWithUploader(
	userId,
	{
		publishedOnly = false,
		limit = TRACK_PAGE_SIZE,
		cursor = null,
		direction = 'older',
		inclusive = false
	} = {}
) {
	const decoded = cursor ? decodeCursor(cursor) : null;
	const own = await selectOwnTracks(userId, {
		publishedOnly,
		decoded,
		limit,
		direction,
		inclusive
	});

	/** @type {ProfileTrackRow[]} */
	const rows = own.map((row) => ({
		...row,
		kind: /** @type {const} */ ('track'),
		repostedAt: null
	}));
	return keysetPage(rows, limit, itemCursor, direction);
}

/**
 * A creator's own tracks, published playlists, and reposted tracks — newest event first.
 * Reposts of unpublished tracks are never returned.
 *
 * Sources are walked as independent keysets over the same `(at, id)` space
 * and merged in memory, so the page boundary lands in the same place regardless
 * of which source a given item came from.
 *
 * @param {string} userId
 * @param {{ publishedOnly?: boolean } & PageOptions} [options]
 * @returns {Promise<{ rows: ProfileItemRow[], nextCursor: string | null }>}
 */
export async function listProfileItemsWithUploader(
	userId,
	{
		publishedOnly = false,
		limit = TRACK_PAGE_SIZE,
		cursor = null,
		direction = 'older',
		inclusive = false
	} = {}
) {
	const { listPlaylistRows } = await import('#lib/server/playlists');
	const decoded = cursor ? decodeCursor(cursor) : null;

	/** @type {import('drizzle-orm').SQL[]} */
	const repostConditions = [eq(trackRepost.userId, userId), eq(track.published, true)];
	if (decoded) {
		repostConditions.push(
			keysetCondition(trackRepost.createdAt, trackRepost.trackId, decoded, direction, inclusive)
		);
	}

	const [own, reposted, playlists] = await Promise.all([
		selectOwnTracks(userId, { publishedOnly, decoded, limit, direction, inclusive }),
		db
			.select({
				track: track,
				username: profile.username,
				uploaderName: user.name,
				repostedAt: trackRepost.createdAt
			})
			.from(trackRepost)
			.innerJoin(track, eq(track.id, trackRepost.trackId))
			.leftJoin(profile, eq(profile.userId, track.userId))
			.leftJoin(user, eq(user.id, track.userId))
			.where(and(...repostConditions))
			.orderBy(...keysetOrder(trackRepost.createdAt, trackRepost.trackId, direction))
			.limit(limit + 1),
		listPlaylistRows({
			userIds: [userId],
			publishedOnly,
			limit,
			cursor,
			direction,
			inclusive
		})
	]);

	/** @type {ProfileItemRow[]} */
	const rows = [
		...own.map((row) => ({
			...row,
			kind: /** @type {const} */ ('track'),
			repostedAt: /** @type {number | null} */ (null)
		})),
		...reposted.map((row) => ({
			...row,
			kind: /** @type {const} */ ('track'),
			repostedAt: row.repostedAt?.getTime() ?? null
		})),
		...playlists.rows.map((row) => ({
			kind: /** @type {const} */ ('playlist'),
			playlist: row.playlist,
			username: row.username,
			uploaderName: row.uploaderName
		}))
	];

	rows.sort(keysetComparator(itemSortAt, itemSortId, direction));
	return keysetPage(rows, limit, itemCursor, direction);
}

/**
 * One track row with uploader profile info.
 * @param {string} trackId
 */
export async function getTrackWithUploader(trackId) {
	const rows = await db
		.select({
			track: track,
			username: profile.username,
			uploaderName: user.name
		})
		.from(track)
		.leftJoin(profile, eq(profile.userId, track.userId))
		.leftJoin(user, eq(user.id, track.userId))
		.where(eq(track.id, trackId))
		.limit(1);
	return rows[0] ?? null;
}
