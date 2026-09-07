import { copyFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { and, eq } from 'drizzle-orm';
import { PROPERTIES, TagLib } from 'taglib-wasm';

import { db } from '#lib/server/db/index.js';
import { track } from '#lib/server/db/schema.js';
import {
	audioColumnsFromStream,
	casTrackMedia,
	discardStaleObject,
	extFromFilename,
	isBrowserStreamableMaster,
	isMasterObjectName,
	playbackAliasesMaster,
	playbackObjectName,
	resolveMasterSource
} from '#lib/server/media/assets.js';
import { checkUploadAllowed } from '#lib/server/quota.js';
import {
	getStorageAdapter,
	isHostedStorageAdapter,
	parseStoredAdapter
} from '#lib/server/storage/index.js';
import { localTrackFilePath } from '#lib/server/storage/local-path.js';
import { stageAdapterObjectToFile } from '#lib/server/storage/stage.js';

/**
 * Track columns paired with their TagLib property keys.
 *
 * `writeKey` is the uppercase key `setProperty` expects; `readKey` is the key
 * the property map comes back under, which differs for every property TagLib
 * models natively. `DESCRIPTION` is not modelled, so it uses the raw key for
 * both — and on Vorbis-comment formats (flac, ogg) it aliases COMMENT, so it
 * only lands when the file has no comment.
 *
 * @type {{ field: string, label: string, writeKey: string, readKey: string }[]}
 */
const TAG_FIELDS = [
	{ field: 'title', label: 'title', writeKey: PROPERTIES.title.key, readKey: 'title' },
	{ field: 'artist', label: 'artist', writeKey: PROPERTIES.artist.key, readKey: 'artist' },
	{ field: 'album', label: 'album', writeKey: PROPERTIES.album.key, readKey: 'album' },
	{
		field: 'albumArtist',
		label: 'album artist',
		writeKey: PROPERTIES.albumArtist.key,
		readKey: 'albumArtist'
	},
	{ field: 'genre', label: 'genre', writeKey: PROPERTIES.genre.key, readKey: 'genre' },
	{ field: 'year', label: 'year', writeKey: PROPERTIES.date.key, readKey: 'date' },
	{
		field: 'trackNumber',
		label: 'track number',
		writeKey: PROPERTIES.trackNumber.key,
		readKey: 'trackNumber'
	},
	{
		field: 'discNumber',
		label: 'disc number',
		writeKey: PROPERTIES.discNumber.key,
		readKey: 'discNumber'
	},
	{ field: 'bpm', label: 'BPM', writeKey: PROPERTIES.bpm.key, readKey: 'bpm' },
	{ field: 'isrc', label: 'ISRC', writeKey: PROPERTIES.isrc.key, readKey: 'isrc' },
	{
		field: 'composer',
		label: 'composer',
		writeKey: PROPERTIES.composer.key,
		readKey: 'composer'
	},
	{ field: 'comment', label: 'comment', writeKey: PROPERTIES.comment.key, readKey: 'comment' },
	{
		field: 'description',
		label: 'description',
		writeKey: 'DESCRIPTION',
		readKey: 'DESCRIPTION'
	}
];

/** @type {Promise<import('taglib-wasm').TagLib> | undefined} */
let taglibPromise;

function getTagLib() {
	taglibPromise ??= TagLib.initialize();
	return taglibPromise;
}

/**
 * @param {string[] | undefined} values
 * @returns {boolean}
 */
function isBlankTag(values) {
	return !values?.some((value) => value.trim() !== '');
}

/**
 * Choose the file write-tags may mutate. Master is never the target.
 *
 * @param {typeof track.$inferSelect} row
 * @returns {{ ok: true, sourceName: string, sourceMime: string, destName: string, destMime: string, cow: boolean } | { ok: false, message: string }}
 */
function resolveTagTarget(row) {
	const master = resolveMasterSource(row);
	if (!master) {
		return { ok: false, message: 'Master audio is missing.' };
	}

	if (row.playbackFilename && row.playbackFilename !== master.filename) {
		if (isMasterObjectName(row.playbackFilename)) {
			return { ok: false, message: 'Refusing to tag a master object.' };
		}
		return {
			ok: true,
			sourceName: row.playbackFilename,
			sourceMime: row.playbackMime || 'audio/mpeg',
			destName: row.playbackFilename,
			destMime: row.playbackMime || 'audio/mpeg',
			cow: false
		};
	}

	if (playbackAliasesMaster(row) && isBrowserStreamableMaster(master.mime, master.filename)) {
		const ext = extFromFilename(master.filename) || 'mp3';
		const destName = playbackObjectName(row.mediaRevision, ext);
		if (isMasterObjectName(destName)) {
			return { ok: false, message: 'Refusing to tag a master object.' };
		}
		return {
			ok: true,
			sourceName: master.filename,
			sourceMime: master.mime,
			destName,
			destMime: master.mime,
			cow: true
		};
	}

	if (row.playbackStatus === 'queued') {
		return {
			ok: false,
			message: 'Playback is still encoding. Tags stay in the library until that finishes.'
		};
	}
	if (row.playbackStatus === 'failed') {
		return {
			ok: false,
			message:
				'Playback encode failed, so tags were not written to a file. The original is unchanged.'
		};
	}

	return {
		ok: false,
		message: 'Tags stay in the library. The original upload is never rewritten.'
	};
}

/**
 * Write the track's saved metadata into its playback file.
 *
 * - Never mutates `master-*`.
 * - If playback aliases a sane MP3/AAC/M4A master, copy-on-write a playback
 *   object, tag that, then CAS-publish.
 * - `gapfill` (default): only blank tags; aborts if a write would clobber existing tags.
 * - `overwrite`: replace tags for every non-empty DB field; blank DB fields are left alone.
 *
 * @param {string} userId
 * @param {string} trackId
 * @param {{ mode?: 'gapfill' | 'overwrite', revision?: string }} [options]
 * @returns {Promise<{ ok: true, written: string[] } | { ok: false, message: string }>}
 */
export async function embedTrackTags(userId, trackId, { mode = 'gapfill', revision } = {}) {
	const overwrite = mode === 'overwrite';
	const rows = await db
		.select()
		.from(track)
		.where(and(eq(track.id, trackId), eq(track.userId, userId)))
		.limit(1);
	const row = rows[0];
	if (!row) {
		return { ok: false, message: 'Track not found.' };
	}

	if (revision && row.mediaRevision !== revision) {
		return {
			ok: false,
			message: 'This track was replaced while tags were writing. Nothing was changed.'
		};
	}

	const target = resolveTagTarget(row);
	if (!target.ok) return target;

	let storage;
	try {
		storage = await getStorageAdapter(userId, parseStoredAdapter(row.storageAdapter));
	} catch (err) {
		return {
			ok: false,
			message: err instanceof Error ? err.message : 'Storage is not available.'
		};
	}

	/** @type {string | null} */
	let tempDir = null;
	try {
		tempDir = await mkdtemp(path.join(tmpdir(), 'sndbnk-embed-tags-'));
		const ext = extFromFilename(target.sourceName) || 'bin';
		const inputPath = path.join(tempDir, `input.${ext}`);
		const outputPath = path.join(tempDir, `tagged.${ext}`);

		try {
			if (parseStoredAdapter(row.storageAdapter) === 'local') {
				const livePath = localTrackFilePath(userId, row.folderKey, target.sourceName);
				if (!(await Bun.file(livePath).exists())) {
					return { ok: false, message: 'Could not read the audio file from storage.' };
				}
				// Copy so a failed tag never mutates the live object.
				await copyFile(livePath, inputPath);
			} else {
				await stageAdapterObjectToFile(storage, row.folderKey, target.sourceName, inputPath);
			}
		} catch (err) {
			return {
				ok: false,
				message: err instanceof Error ? err.message : 'Could not read the audio file from storage.'
			};
		}

		const taglib = await getTagLib();

		/** @type {{ label: string, readKey: string, value: string }[]} */
		let planned = [];
		/** @type {import('taglib-wasm').PropertyMap} */
		let before;

		const file = await taglib.open(inputPath);
		try {
			if (!file.isValid()) {
				return { ok: false, message: 'This audio file does not support embedded tags.' };
			}

			before = file.properties();

			for (const { field, label, writeKey, readKey } of TAG_FIELDS) {
				const raw = /** @type {Record<string, unknown>} */ (row)[field];
				if (raw == null || raw === '') continue;
				if (!overwrite && !isBlankTag(before[readKey])) continue;

				const value = String(raw);
				file.setProperty(writeKey, value);
				planned.push({ label, readKey, value });
			}

			if (planned.length === 0) {
				return { ok: true, written: [] };
			}

			if (!file.save()) {
				return { ok: false, message: 'Could not write tags into this audio file.' };
			}

			try {
				await file.saveToFile(outputPath);
			} catch {
				// Path backends may refuse saveToFile; the in-memory buffer is the fallback.
				const updated = file.getFileBuffer();
				await Bun.write(outputPath, updated);
			}
		} finally {
			file.dispose();
		}

		// Confirm against the saved copy rather than trusting the writes: formats
		// silently drop or alias keys they cannot represent.
		/** @type {string[]} */
		const written = [];
		const plannedValues = new Set(planned.map(({ value }) => value));
		const verify = await taglib.open(outputPath);
		try {
			const after = verify.properties();

			if (!overwrite) {
				for (const key of Object.keys(before)) {
					if (isBlankTag(before[key])) continue;
					// Only a value we destroyed or replaced counts as a clobber; TagLib
					// normalising its own encoding of a tag on rewrite is fine.
					const lost = isBlankTag(after[key]);
					const clobbered = after[key]?.some(
						(value) => plannedValues.has(value) && !before[key].includes(value)
					);
					if (lost || clobbered) {
						return {
							ok: false,
							message: `Aborted: writing tags would have replaced the existing ${key} tag.`
						};
					}
				}
			}

			for (const { label, readKey, value } of planned) {
				if (after[readKey]?.[0] === value) written.push(label);
			}
		} finally {
			verify.dispose();
		}

		if (written.length === 0) {
			return { ok: true, written: [] };
		}

		const taggedSize = (await stat(outputPath)).size;

		if (target.cow && isHostedStorageAdapter(parseStoredAdapter(row.storageAdapter))) {
			const quota = await checkUploadAllowed(userId, {
				newTrack: false,
				addedBytes: taggedSize,
				adapter: row.storageAdapter,
				replacesBytes: 0
			});
			if (!quota.ok) {
				return { ok: false, message: quota.message };
			}
		}

		if (revision && row.mediaRevision !== revision) {
			return {
				ok: false,
				message: 'This track was replaced while tags were writing. Nothing was changed.'
			};
		}

		const taggedBytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer());
		try {
			await storage.put(row.folderKey, target.destName, taggedBytes, target.destMime);
		} catch (err) {
			return {
				ok: false,
				message: err instanceof Error ? err.message : 'Could not save the tagged audio file.'
			};
		}

		const stream = { filename: target.destName, mime: target.destMime, bytes: taggedSize };
		const published = await casTrackMedia(trackId, row.mediaRevision, {
			playbackFilename: target.destName,
			playbackMime: target.destMime,
			playbackBytes: taggedSize,
			playbackStatus: 'ready',
			playbackError: null,
			playbackUpdatedAt: new Date(),
			...audioColumnsFromStream(row, stream)
		});

		if (!published) {
			if (target.cow) {
				await discardStaleObject(storage, row.folderKey, target.destName);
			}
			return {
				ok: false,
				message: 'This track was replaced while tags were writing. Nothing was changed.'
			};
		}

		return { ok: true, written };
	} finally {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true }).catch(() => {
				// temp dir may already be gone
			});
		}
	}
}
