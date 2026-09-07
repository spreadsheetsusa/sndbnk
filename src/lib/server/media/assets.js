import { createHash } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import { db } from '#lib/server/db/index.js';
import { track } from '#lib/server/db/schema.js';

/** @typedef {'queued' | 'ready' | 'failed'} PlaybackStatus */

/**
 * @typedef {{
 *   mediaRevision?: string | null,
 *   masterFilename?: string | null,
 *   masterMime?: string | null,
 *   masterBytes?: number | null,
 *   playbackFilename?: string | null,
 *   playbackMime?: string | null,
 *   playbackBytes?: number | null,
 *   playbackStatus?: string | null,
 *   audioFilename?: string | null,
 *   audioMime?: string | null,
 *   audioBytes?: number | null,
 *   originalFilename?: string | null,
 *   originalMime?: string | null,
 *   originalBytes?: number | null,
 *   coverBytes?: number | null
 * }} MediaRow
 */

const STREAMABLE_EXT = new Set(['mp3', 'aac', 'm4a']);

/** @type {Record<string, string>} */
const STREAMABLE_MIME = {
	'audio/mpeg': 'mp3',
	'audio/mp3': 'mp3',
	'audio/aac': 'aac',
	'audio/mp4': 'm4a',
	'audio/x-m4a': 'm4a'
};

/** Browsers can play these while a 320k derivative is still encoding. */
const INTERIM_EXT = new Set(['wav', 'ogg']);
const INTERIM_MIME = new Set(['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg']);

/**
 * @returns {string}
 */
export function createMediaRevision() {
	return crypto.randomUUID().replaceAll('-', '');
}

/**
 * @param {string | null | undefined} filename
 */
export function extFromFilename(filename) {
	if (!filename) return '';
	const idx = filename.lastIndexOf('.');
	if (idx < 0) return '';
	return filename.slice(idx + 1).toLowerCase();
}

/**
 * @param {string} revision
 * @param {string} ext
 */
export function masterObjectName(revision, ext) {
	const safe = (ext || 'bin').replace(/^\./, '').toLowerCase();
	return `master-${revision}.${safe}`;
}

/**
 * @param {string} revision
 * @param {string} [ext]
 */
export function playbackObjectName(revision, ext = 'mp3') {
	const safe = (ext || 'mp3').replace(/^\./, '').toLowerCase();
	return `playback-${revision}.${safe}`;
}

/**
 * @param {string} revision
 */
export function waveformObjectName(revision) {
	return `waveform-${revision}.json`;
}

/**
 * @param {string | null | undefined} filename
 */
export function isMasterObjectName(filename) {
	return typeof filename === 'string' && filename.startsWith('master-');
}

/**
 * @param {Uint8Array | Buffer} bytes
 */
export function sha256Hex(bytes) {
	return createHash('sha256').update(bytes).digest('hex');
}

/**
 * @param {string | null | undefined} mime
 * @param {string | null | undefined} [filename]
 */
export function isBrowserStreamableMaster(mime, filename) {
	const normalized = (mime ?? '').toLowerCase();
	if (STREAMABLE_MIME[normalized]) return true;
	return STREAMABLE_EXT.has(extFromFilename(filename));
}

/**
 * Playback aliases master (no duplicate file) when the master itself is a
 * sane browser stream (MP3 / AAC / M4A).
 *
 * @param {MediaRow} row
 */
export function playbackAliasesMaster(row) {
	const masterName = row.masterFilename || row.audioFilename;
	const masterMime = row.masterMime || row.audioMime;
	if (!isBrowserStreamableMaster(masterMime, masterName)) return false;
	if (!row.playbackFilename) return true;
	return row.playbackFilename === masterName;
}

/**
 * Needs a 320k MP3 derivative: master is not a sane stream format and no
 * ready playback file exists yet (or encode previously failed).
 *
 * @param {MediaRow} row
 */
export function trackNeedsPlaybackMp3(row) {
	if (playbackAliasesMaster(row)) return false;
	if (row.playbackFilename && row.playbackStatus === 'ready') return false;
	return true;
}

/**
 * @param {string | null | undefined} mime
 * @param {string | null | undefined} filename
 */
function isInterimStreamableMaster(mime, filename) {
	if (isBrowserStreamableMaster(mime, filename)) return true;
	if (INTERIM_MIME.has((mime ?? '').toLowerCase())) return true;
	return INTERIM_EXT.has(extFromFilename(filename));
}

/**
 * File the public player may stream. Never falls back to an unplayable master
 * when playback failed or is still encoding.
 *
 * @param {MediaRow} row
 * @returns {{ filename: string, mime: string, bytes: number, role: 'playback' | 'master' } | null}
 */
export function resolveStreamSource(row) {
	const masterName = row.masterFilename || row.audioFilename;
	const masterMime = row.masterMime || row.audioMime || 'application/octet-stream';
	const masterBytes = row.masterBytes ?? row.audioBytes ?? 0;

	if (row.playbackFilename && (row.playbackStatus === 'ready' || !row.playbackStatus)) {
		return {
			filename: row.playbackFilename,
			mime: row.playbackMime || 'audio/mpeg',
			bytes: row.playbackBytes ?? 0,
			role: 'playback'
		};
	}

	if (row.playbackStatus === 'failed') {
		return isBrowserStreamableMaster(masterMime, masterName) && masterName
			? { filename: masterName, mime: masterMime, bytes: masterBytes, role: 'master' }
			: null;
	}

	if (masterName && isInterimStreamableMaster(masterMime, masterName)) {
		return { filename: masterName, mime: masterMime, bytes: masterBytes, role: 'master' };
	}

	return null;
}

/**
 * Owner download always targets the immutable master.
 *
 * @param {MediaRow} row
 * @returns {{ filename: string, mime: string, bytes: number } | null}
 */
export function resolveMasterSource(row) {
	const filename = row.masterFilename || row.originalFilename || row.audioFilename;
	if (!filename) return null;
	return {
		filename,
		mime: row.masterMime || row.originalMime || row.audioMime || 'application/octet-stream',
		bytes: row.masterBytes ?? row.originalBytes ?? row.audioBytes ?? 0
	};
}

/**
 * Physical hosted bytes: master + generated playback (if distinct) + cover.
 * No double-count when playback aliases master.
 *
 * @param {MediaRow} row
 */
export function hostedCommittedBytes(row) {
	const masterBytes = row.masterBytes ?? row.originalBytes ?? row.audioBytes ?? 0;
	const coverBytes = row.coverBytes ?? 0;
	const playbackBytes = row.playbackBytes ?? 0;
	const distinctPlayback =
		Boolean(row.playbackFilename) &&
		row.playbackFilename !== (row.masterFilename || row.audioFilename);
	return masterBytes + (distinctPlayback ? playbackBytes : 0) + coverBytes;
}

/**
 * SQL fragment matching {@link hostedCommittedBytes} for hosted-quota sums.
 */
export function hostedCommittedBytesSql() {
	return sql`coalesce(${track.masterBytes}, ${track.audioBytes}) + case
		when ${track.playbackFilename} is not null
			and ${track.playbackFilename} != ${track.masterFilename}
		then coalesce(${track.playbackBytes}, 0)
		else 0
	end + coalesce(${track.coverBytes}, 0)`;
}

/**
 * Publish a track patch only if `mediaRevision` still matches. Returns false
 * when a newer upload won the race — caller should discard the object.
 *
 * @param {string} trackId
 * @param {string} revision
 * @param {Record<string, unknown>} patch
 * @returns {Promise<boolean>}
 */
export async function casTrackMedia(trackId, revision, patch) {
	if (!revision) return false;
	const updated = await db
		.update(track)
		.set({ ...patch, updatedAt: new Date() })
		.where(and(eq(track.id, trackId), eq(track.mediaRevision, revision)))
		.returning({ id: track.id });
	return updated.length > 0;
}

/**
 * Best-effort delete of a stale worker object after a lost CAS.
 *
 * @param {{ deleteObject: (folderKey: string, filename: string) => Promise<void> }} storage
 * @param {string} folderKey
 * @param {string | null | undefined} filename
 */
export async function discardStaleObject(storage, folderKey, filename) {
	if (!filename) return;
	try {
		await storage.deleteObject(folderKey, filename);
	} catch {
		// orphan until folder delete — never overwrite a master to "fix" this
	}
}

/**
 * Columns to keep `audio*` pointing at the current stream file (legacy readers
 * + SSH public URLs). `original*` is left untouched going forward.
 *
 * @param {MediaRow} row
 * @param {{ filename: string, mime: string, bytes: number } | null} stream
 */
export function audioColumnsFromStream(row, stream) {
	if (stream) {
		return {
			audioFilename: stream.filename,
			audioMime: stream.mime,
			audioBytes: stream.bytes
		};
	}
	const master = resolveMasterSource(row);
	if (!master) return {};
	return {
		audioFilename: master.filename,
		audioMime: master.mime,
		audioBytes: master.bytes
	};
}

/**
 * @param {unknown} value
 * @returns {PlaybackStatus | null}
 */
export function parsePlaybackStatus(value) {
	if (value === 'queued' || value === 'ready' || value === 'failed') return value;
	return null;
}
