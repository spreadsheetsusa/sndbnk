import { and, eq } from 'drizzle-orm';
import { PROPERTIES, TagLib } from 'taglib-wasm';

import { db } from '#lib/server/db';
import { track } from '#lib/server/db/schema';
import { getStorageAdapter } from '#lib/server/storage';
import { getOwnedTrack } from '#lib/server/tracks';

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
	{ field: 'genre', label: 'genre', writeKey: PROPERTIES.genre.key, readKey: 'genre' },
	{ field: 'year', label: 'year', writeKey: PROPERTIES.date.key, readKey: 'date' },
	{
		field: 'trackNumber',
		label: 'track number',
		writeKey: PROPERTIES.trackNumber.key,
		readKey: 'trackNumber'
	},
	{ field: 'bpm', label: 'BPM', writeKey: PROPERTIES.bpm.key, readKey: 'bpm' },
	{ field: 'isrc', label: 'ISRC', writeKey: PROPERTIES.isrc.key, readKey: 'isrc' },
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
 * Storage adapters hand back a BunFile (local) or a Uint8Array (ssh).
 * @param {import('#lib/server/storage/types.js').StorageObject['body']} body
 * @returns {Promise<Uint8Array>}
 */
async function toBytes(body) {
	if (body instanceof Uint8Array) return body;
	if (typeof Blob !== 'undefined' && body instanceof Blob) {
		return new Uint8Array(await body.arrayBuffer());
	}
	return new Uint8Array(await new Response(/** @type {ReadableStream} */ (body)).arrayBuffer());
}

/**
 * @param {string[] | undefined} values
 * @returns {boolean}
 */
function isBlankTag(values) {
	return !values?.some((value) => value.trim() !== '');
}

/**
 * Write the track's saved metadata into its audio file, but only into tags the
 * file leaves empty. Values already present in the file are never replaced.
 *
 * @param {string} userId
 * @param {string} trackId
 * @returns {Promise<{ ok: true, written: string[] } | { ok: false, message: string }>}
 */
export async function embedTrackTags(userId, trackId) {
	const row = await getOwnedTrack(userId, trackId);
	if (!row) {
		return { ok: false, message: 'Track not found.' };
	}

	let storage;
	try {
		storage = await getStorageAdapter(userId, /** @type {'local' | 'ssh'} */ (row.storageAdapter));
	} catch (err) {
		return {
			ok: false,
			message: err instanceof Error ? err.message : 'Storage is not available.'
		};
	}

	/** @type {Uint8Array} */
	let bytes;
	try {
		const object = await storage.get(row.folderKey, row.audioFilename);
		bytes = await toBytes(object.body);
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
	/** @type {Uint8Array} */
	let updated;

	const file = await taglib.open(bytes);
	try {
		if (!file.isValid()) {
			return { ok: false, message: 'This audio file does not support embedded tags.' };
		}

		before = file.properties();

		for (const { field, label, writeKey, readKey } of TAG_FIELDS) {
			const raw = /** @type {Record<string, unknown>} */ (row)[field];
			if (raw == null || raw === '') continue;
			if (!isBlankTag(before[readKey])) continue;

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

		updated = file.getFileBuffer();
	} finally {
		file.dispose();
	}

	// Confirm against the saved bytes rather than trusting the writes: formats
	// silently drop or alias keys they cannot represent.
	/** @type {string[]} */
	const written = [];
	const plannedValues = new Set(planned.map(({ value }) => value));
	const verify = await taglib.open(updated);
	try {
		const after = verify.properties();

		for (const key of Object.keys(before)) {
			if (isBlankTag(before[key])) continue;
			// Only a value we destroyed or replaced counts as a clobber; TagLib
			// normalising its own encoding of a tag on rewrite is fine.
			const lost = isBlankTag(after[key]);
			const overwritten = after[key]?.some(
				(value) => plannedValues.has(value) && !before[key].includes(value)
			);
			if (lost || overwritten) {
				return {
					ok: false,
					message: `Aborted: writing tags would have replaced the existing ${key} tag.`
				};
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

	try {
		await storage.put(row.folderKey, row.audioFilename, updated, row.audioMime);
	} catch (err) {
		return {
			ok: false,
			message: err instanceof Error ? err.message : 'Could not save the tagged audio file.'
		};
	}

	await db
		.update(track)
		.set({ audioBytes: updated.byteLength, updatedAt: new Date() })
		.where(and(eq(track.id, trackId), eq(track.userId, userId)));

	return { ok: true, written };
}
