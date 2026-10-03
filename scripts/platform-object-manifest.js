/**
 * List platform objects the local media tree is missing.
 * Stdout is JSONL for `pull-platform-objects.js`. Summary goes to stderr.
 *
 *   bun ./scripts/platform-object-manifest.js --db local.db --media ./media
 *
 * Covers site-library images, avatars, site logo/OG, and hosted tracks
 * (`local` / `s3`). SSH tracks stay on the creator's server.
 */
import { stat } from 'node:fs/promises';
import path from 'node:path';

import { Database } from 'bun:sqlite';

import { assertSafeStorageSegment } from '../src/lib/server/storage/path-safety.js';

const args = parseArgs(process.argv.slice(2));
const dbPath = args.get('--db');
const mediaRoot = args.get('--media');
if (!dbPath || !mediaRoot) {
	die('usage: platform-object-manifest.js --db PATH --media PATH');
}

const db = new Database(dbPath, { readonly: true });

/** @type {Map<string, PlatformObject>} */
const objects = new Map();

for (const row of db
	.query(
		`SELECT user_id AS userId, id, filename, bytes
		 FROM site_media`
	)
	.all()) {
	add({
		userId: row.userId,
		folderKey: `sm-${row.id}`,
		filename: row.filename,
		bytes: row.bytes,
		required: true,
		kind: 'site-media'
	});
}

for (const row of db
	.query(
		`SELECT user_id AS userId, avatar_filename AS filename
		 FROM profile
		 WHERE avatar_filename IS NOT NULL AND avatar_filename != ''`
	)
	.all()) {
	add({
		userId: row.userId,
		folderKey: 'avatar',
		filename: row.filename,
		bytes: 0,
		required: true,
		kind: 'avatar'
	});
}

for (const row of db
	.query(
		`SELECT user_id AS userId, logo_filename AS logoFilename, og_image_filename AS ogFilename
		 FROM site`
	)
	.all()) {
	if (row.logoFilename) {
		add({
			userId: row.userId,
			folderKey: 'site-logo',
			filename: row.logoFilename,
			bytes: 0,
			required: true,
			kind: 'site-logo'
		});
	}
	if (row.ogFilename) {
		add({
			userId: row.userId,
			folderKey: 'site-og',
			filename: row.ogFilename,
			bytes: 0,
			required: true,
			kind: 'site-og'
		});
	}
}

const tracks = db
	.query(
		`SELECT user_id AS userId, folder_key AS folderKey,
		        master_filename AS masterFilename, master_bytes AS masterBytes,
		        playback_filename AS playbackFilename, playback_bytes AS playbackBytes,
		        audio_filename AS audioFilename, audio_bytes AS audioBytes,
		        original_filename AS originalFilename, original_bytes AS originalBytes,
		        cover_filename AS coverFilename, cover_bytes AS coverBytes,
		        media_revision AS mediaRevision
		 FROM track
		 WHERE storage_adapter IN ('local', 's3')`
	)
	.all();

for (const row of tracks) {
	const hasMaster = Boolean(row.masterFilename);
	addTrackFile(row, row.masterFilename, row.masterBytes, true);
	addTrackFile(row, row.playbackFilename, row.playbackBytes, false);
	addTrackFile(row, row.audioFilename, row.audioBytes, !hasMaster);
	addTrackFile(row, row.originalFilename, row.originalBytes, false);
	addTrackFile(row, row.coverFilename, row.coverBytes, true);
}

/** @type {PlatformObject[]} */
const missing = [];
let present = 0;
for (const object of objects.values()) {
	if (await alreadyLocal(object)) {
		present += 1;
		continue;
	}
	missing.push(object);
	process.stdout.write(`${JSON.stringify(object)}\n`);
}

const byKind = new Map();
let bytes = 0;
for (const object of missing) {
	byKind.set(object.kind, (byKind.get(object.kind) ?? 0) + 1);
	bytes += object.bytes > 0 ? object.bytes : 0;
}
const kindSummary = [...byKind.entries()].map(([kind, count]) => `${kind} ${count}`).join(', ');
const sizeNote = bytes > 0 ? `, ~${formatBytes(bytes)} known` : '';
console.error(
	missing.length === 0
		? `platform objects: nothing missing locally (${present} already on disk)`
		: `platform objects: ${missing.length} to fetch (${kindSummary}${sizeNote}), ${present} already on disk`
);

/**
 * @typedef {Object} PlatformObject
 * @property {string} userId
 * @property {string} folderKey
 * @property {string} filename
 * @property {number} bytes
 * @property {boolean} required
 * @property {string} kind
 */

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
	/** @type {Map<string, string>} */
	const opts = new Map();
	for (let i = 0; i < argv.length; i += 1) {
		const key = argv[i];
		if (!key.startsWith('--')) die(`unknown argument: ${key}`);
		const value = argv[i + 1];
		if (!value || value.startsWith('--')) die(`missing value for ${key}`);
		opts.set(key, value);
		i += 1;
	}
	return opts;
}

/**
 * @param {PlatformObject} object
 */
function add(object) {
	let userId;
	let folderKey;
	let filename;
	try {
		assertSafeStorageSegment(object.userId, 'user id');
		assertSafeStorageSegment(object.folderKey, 'folder key');
		assertSafeStorageSegment(object.filename, 'filename');
		userId = object.userId;
		folderKey = object.folderKey;
		filename = object.filename;
	} catch (err) {
		const reason = err instanceof Error ? err.message : 'unsafe path';
		console.error(`platform objects: skip unsafe ${object.kind}: ${reason}`);
		return;
	}

	const key = `${userId}/${folderKey}/${filename}`;
	const prev = objects.get(key);
	if (!prev) {
		objects.set(key, { ...object, userId, folderKey, filename, bytes: object.bytes || 0 });
		return;
	}
	prev.required = prev.required || object.required;
	if ((object.bytes || 0) > prev.bytes) prev.bytes = object.bytes;
}

/**
 * @param {{ userId: string, folderKey: string }} row
 * @param {string | null | undefined} filename
 * @param {number | null | undefined} bytes
 * @param {boolean} required
 */
function addTrackFile(row, filename, bytes, required) {
	if (!filename) return;
	add({
		userId: row.userId,
		folderKey: row.folderKey,
		filename,
		bytes: bytes || 0,
		required,
		kind: 'track'
	});
}

/**
 * A file already on disk with the expected size does not need another copy.
 * Objects without a stored size count as present when the file is non-empty.
 * @param {PlatformObject} object
 */
async function alreadyLocal(object) {
	try {
		const info = await stat(path.join(mediaRoot, object.userId, object.folderKey, object.filename));
		if (!info.isFile() || info.size <= 0) return false;
		if (object.bytes > 0) return info.size === object.bytes;
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {number} size
 */
function formatBytes(size) {
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
	if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
	return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * @param {string} message
 */
function die(message) {
	console.error(`error: ${message}`);
	process.exit(1);
}
