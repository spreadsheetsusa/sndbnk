import { and, desc, eq } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { track } from '#lib/server/db/schema';
import { getOrCreateStorageSetting, getStorageAdapter } from '#lib/server/storage';

const AUDIO_MAX_BYTES = 100 * 1024 * 1024;
const COVER_MAX_BYTES = 5 * 1024 * 1024;

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
	'image/webp': 'webp'
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
	const isrc = formData.get('isrc')?.toString().trim() || null;
	const comment = formData.get('comment')?.toString().trim() || null;

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
			description,
			artist,
			album,
			genre,
			year,
			trackNumber,
			bpm,
			isrc,
			comment,
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
export function validateAudioFile(file) {
	const mime = (file.type || '').toLowerCase();
	const ext = extFromName(file.name);
	const allowedExt = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a']);

	let resolvedExt = AUDIO_EXT_BY_MIME[mime];
	if (!resolvedExt && allowedExt.has(ext)) {
		resolvedExt = ext === 'jpeg' ? 'jpg' : ext;
	}

	if (!resolvedExt) {
		return {
			ok: false,
			message: 'Audio must be mp3, wav, flac, aac, ogg, or m4a.'
		};
	}

	if (file.size > AUDIO_MAX_BYTES) {
		return { ok: false, message: 'Audio must be 100MB or smaller.' };
	}

	return {
		ok: true,
		filename: `audio.${resolvedExt}`,
		mime: mime || `audio/${resolvedExt === 'mp3' ? 'mpeg' : resolvedExt}`,
		bytes: file.size
	};
}

/**
 * @param {File} file
 */
export function validateCoverFile(file) {
	const mime = (file.type || '').toLowerCase();
	const ext = extFromName(file.name);
	const allowedExt = new Set(['jpg', 'jpeg', 'png', 'webp']);

	let resolvedExt = COVER_EXT_BY_MIME[mime];
	if (!resolvedExt && allowedExt.has(ext)) {
		resolvedExt = ext === 'jpeg' ? 'jpg' : ext;
	}

	if (!resolvedExt) {
		return { ok: false, message: 'Cover art must be jpg, png, or webp.' };
	}

	if (file.size > COVER_MAX_BYTES) {
		return { ok: false, message: 'Cover art must be 5MB or smaller.' };
	}

	return {
		ok: true,
		filename: `cover.${resolvedExt}`,
		mime: mime || `image/${resolvedExt === 'jpg' ? 'jpeg' : resolvedExt}`,
		bytes: file.size
	};
}

/**
 * @param {string} userId
 */
export async function listTracksForUser(userId) {
	return db.select().from(track).where(eq(track.userId, userId)).orderBy(desc(track.createdAt));
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

	const audioResult = validateAudioFile(audioEntry);
	if (!audioResult.ok) return audioResult;

	const coverEntry = formData.get('cover');
	/** @type {{ filename: string, mime: string, bytes: number } | null} */
	let coverResult = null;
	if (isFile(coverEntry)) {
		const validated = validateCoverFile(coverEntry);
		if (!validated.ok) return validated;
		coverResult = validated;
	}

	const setting = await getOrCreateStorageSetting(userId);
	const adapterId = /** @type {'local' | 'ssh'} */ (setting.adapter === 'ssh' ? 'ssh' : 'local');

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
		storageAdapter: adapterId,
		folderKey,
		createdAt: now,
		updatedAt: now
	});

	try {
		const audioBytes = new Uint8Array(await audioEntry.arrayBuffer());
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
		const validated = validateAudioFile(/** @type {File} */ (audioEntry));
		if (!validated.ok) return validated;
		audioResult = validated;
		patch.audioFilename = validated.filename;
		patch.audioMime = validated.mime;
		patch.audioBytes = validated.bytes;
	}

	if (replaceCover) {
		const validated = validateCoverFile(/** @type {File} */ (coverEntry));
		if (!validated.ok) return validated;
		coverResult = validated;
		patch.coverFilename = validated.filename;
		patch.coverMime = validated.mime;
		patch.coverBytes = validated.bytes;
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

	return { ok: true };
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
