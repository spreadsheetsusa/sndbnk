/**
 * Lift SNDBNK-hosted media from MEDIA_ROOT (local adapter) to platform S3.
 * SSH BYOS tracks are never touched. Credentials come from env / IAM only.
 *
 * Default is a dry-run (inventory + plan, no copy / flip / purge):
 *   bun run media:migrate-s3
 *   bun run media:migrate-s3 -- --apply
 *   bun run media:migrate-s3 -- --apply --purge-local
 *
 * Optional: `--user` `--limit` `--track` `--report` `--progress` `--inventory`
 *
 * Phases: inventory → copy → verify → flip. `--purge-local` is opt-in and off
 * by default. A durable JSONL progress file resumes a killed run without
 * re-copying objects already verified.
 */
import { appendFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { and, eq, inArray } from 'drizzle-orm';

import { MEDIA_ROOT } from '../src/lib/server/app-env.js';
import { db } from '../src/lib/server/db/index.js';
import { profile, site, track } from '../src/lib/server/db/schema.js';
import { WAVEFORM_FILENAME } from '../src/lib/server/media/waveform.js';
import { parseStoredAdapter } from '../src/lib/server/storage/platform.js';
import {
	createS3Adapter,
	headS3Object,
	md5FileHex,
	putS3ObjectFromFile,
	s3ObjectKey
} from '../src/lib/server/storage/s3.js';
import { getPlatformS3Config } from '../src/lib/server/storage/s3-config.js';
import { assertSafeStorageSegment } from '../src/lib/server/storage/path-safety.js';

// Duplicated from avatar.js / site.js so this script never imports $app/env.
const AVATAR_FOLDER_KEY = 'avatar';
const SITE_LOGO_FOLDER_KEY = 'site-logo';
const SITE_OG_FOLDER_KEY = 'site-og';
const ASSET_FOLDERS = new Set([AVATAR_FOLDER_KEY, SITE_LOGO_FOLDER_KEY, SITE_OG_FOLDER_KEY]);

const args = parseArgs(process.argv.slice(2));
const apply = args.flags.has('--apply');
const dryRun = !apply;
const purgeLocal = args.flags.has('--purge-local');
const userFilter = args.opts.get('--user');
const trackFilter = args.opts.get('--track');
const limit = args.opts.has('--limit') ? Number.parseInt(args.opts.get('--limit') ?? '', 10) : null;
const reportPath = args.opts.get('--report') || '/tmp/sndbnk-migrate-s3-report.json';
const progressPath = args.opts.get('--progress') || '/tmp/sndbnk-migrate-s3-progress.jsonl';
const inventoryPath = args.opts.get('--inventory') || '/tmp/sndbnk-migrate-s3-inventory.json';

/** @type {{ key: string, reason: string, kind: string }[]} */
const failures = [];
/** @type {{ key: string, reason: string, kind: string }[]} */
const skipped = [];
let uploaded = 0;
let verifiedExisting = 0;
let dbUpdated = 0;
let purged = 0;
let considered = 0;

const s3 = getPlatformS3Config();
if (!s3) {
	die('S3_BUCKET is not set. Platform S3 must be configured before migrating.');
}

if (limit != null && (!Number.isInteger(limit) || limit < 1)) {
	die('--limit must be a positive integer.');
}
if (args.flags.has('--dry-run') && apply) {
	die('Pass either --apply or --dry-run, not both.');
}
if (purgeLocal && !apply) {
	die('--purge-local requires --apply (default is a dry-run with no writes).');
}

const progress = await loadProgress(progressPath);
const verifiedKeys = progress.verifiedKeys;
const flippedTracks = progress.flippedTracks;

console.log(
	`[migrate-s3] bucket=${s3.bucket} region=${s3.region} dryRun=${dryRun} apply=${apply} purgeLocal=${purgeLocal}`
);
if (userFilter) console.log(`[migrate-s3] user=${userFilter}`);
if (trackFilter) console.log(`[migrate-s3] track=${trackFilter}`);
if (limit) console.log(`[migrate-s3] limit=${limit} tracks`);
console.log(`[migrate-s3] progress ${path.resolve(progressPath)} (verified=${verifiedKeys.size})`);
if (!apply) {
	console.log('[migrate-s3] dry-run (default). Re-run with --apply to copy / verify / flip.');
}

const seenKeys = new Set();

try {
	const probe = await createS3Adapter('migrate-probe').testConnection();
	if (!probe.ok) {
		die(`S3 probe failed (HeadBucket): ${probe.message}`);
	}

	await writeInventory();
	await migrateTracks();
	if (!trackFilter) {
		await migrateProfileAssets();
		await migrateOrphans();
	}
} finally {
	const report = {
		ok: failures.length === 0,
		dryRun,
		apply,
		purgeLocal,
		bucket: s3.bucket,
		region: s3.region,
		considered,
		uploaded,
		verifiedExisting,
		dbUpdated,
		purged,
		failed: failures,
		skipped,
		progressPath,
		inventoryPath
	};
	await Bun.write(reportPath, JSON.stringify(report, null, 2) + '\n');
	console.log(`[migrate-s3] report ${path.resolve(reportPath)}`);
	console.log(
		`[migrate-s3] done considered=${considered} uploaded=${uploaded} already=${verifiedExisting} dbUpdated=${dbUpdated} purged=${purged} failed=${failures.length} skipped=${skipped.length}`
	);
	if (failures.length > 0) {
		console.error('[migrate-s3] failures:');
		for (const row of failures) {
			console.error(`  ${row.kind} ${row.key}: ${row.reason}`);
		}
		process.exitCode = 1;
	}
}

async function writeInventory() {
	/** @type {import('drizzle-orm').SQL[]} */
	const filters = [];
	if (trackFilter) filters.push(eq(track.id, trackFilter));
	else filters.push(inArray(track.storageAdapter, ['local', 's3']));
	if (userFilter) filters.push(eq(track.userId, userFilter));

	const rows = await db
		.select()
		.from(track)
		.where(filters.length === 1 ? filters[0] : and(...filters));

	const hosted = rows.filter((row) => {
		const kind = parseStoredAdapter(row.storageAdapter);
		return kind === 'local' || kind === 's3';
	});
	const slice = limit ? hosted.slice(0, limit) : hosted;

	/** @type {Record<string, unknown>[]} */
	const items = [];
	for (const row of slice) {
		for (const object of trackObjects(row)) {
			items.push({
				kind: 'track',
				trackId: row.id,
				userId: row.userId,
				folderKey: row.folderKey,
				filename: object.filename,
				expectedSize: object.expectedSize,
				required: object.required,
				storageAdapter: row.storageAdapter
			});
		}
	}

	if (!trackFilter) {
		const avatars = await db
			.select({ userId: profile.userId, filename: profile.avatarFilename })
			.from(profile)
			.where(userFilter ? eq(profile.userId, userFilter) : undefined);
		for (const row of avatars) {
			if (!row.filename) continue;
			items.push({
				kind: 'avatar',
				userId: row.userId,
				folderKey: AVATAR_FOLDER_KEY,
				filename: row.filename,
				required: true
			});
		}

		const sites = await db
			.select({
				userId: site.userId,
				logoFilename: site.logoFilename,
				ogImageFilename: site.ogImageFilename
			})
			.from(site)
			.where(userFilter ? eq(site.userId, userFilter) : undefined);
		for (const row of sites) {
			if (row.logoFilename) {
				items.push({
					kind: 'site-logo',
					userId: row.userId,
					folderKey: SITE_LOGO_FOLDER_KEY,
					filename: row.logoFilename,
					required: true
				});
			}
			if (row.ogImageFilename) {
				items.push({
					kind: 'site-og',
					userId: row.userId,
					folderKey: SITE_OG_FOLDER_KEY,
					filename: row.ogImageFilename,
					required: true
				});
			}
		}
	}

	const payload = {
		ts: new Date().toISOString(),
		apply,
		dryRun,
		bucket: s3.bucket,
		sshExcluded: true,
		tracks: slice.length,
		objects: items.length,
		items
	};
	await Bun.write(inventoryPath, JSON.stringify(payload, null, 2) + '\n');
	await appendProgress({ phase: 'inventory', status: 'ok', count: items.length });
	console.log(
		`[migrate-s3] inventory ${items.length} objects from ${slice.length} hosted tracks → ${path.resolve(inventoryPath)}`
	);
}

async function migrateTracks() {
	/** @type {import('drizzle-orm').SQL[]} */
	const filters = [];
	if (trackFilter) {
		filters.push(eq(track.id, trackFilter));
	} else {
		filters.push(inArray(track.storageAdapter, ['local', 's3']));
	}
	if (userFilter) filters.push(eq(track.userId, userFilter));

	const rows = await db
		.select()
		.from(track)
		.where(filters.length === 1 ? filters[0] : and(...filters));

	const hosted = rows.filter((row) => {
		const kind = parseStoredAdapter(row.storageAdapter);
		return kind === 'local' || kind === 's3';
	});

	const slice = limit ? hosted.slice(0, limit) : hosted;
	console.log(`[migrate-s3] tracks ${slice.length}/${hosted.length}`);

	for (const row of slice) {
		const objects = trackObjects(row);
		/** @type {{ key: string, localPath: string | null, expectedSize: number | null, contentType: string, required: boolean }[]} */
		const plan = [];
		let objectFailed = false;

		for (const object of objects) {
			const result = await migrateObject({
				userId: row.userId,
				folderKey: row.folderKey,
				filename: object.filename,
				expectedSize: object.expectedSize,
				contentType: object.contentType,
				required: object.required,
				kind: 'track'
			});
			// Missing optional waveform.json is a skip, not a fail. Any verify
			// failure (required or optional-that-exists) blocks the flip.
			if (result.status === 'failed') objectFailed = true;
			if (result.key) {
				plan.push({
					key: result.key,
					localPath: result.localPath,
					expectedSize: object.expectedSize,
					contentType: object.contentType,
					required: object.required
				});
			}
		}

		if (objectFailed) {
			skipped.push({
				key: `${row.userId}/${row.folderKey}`,
				kind: 'track',
				reason: 'an object failed verify; storageAdapter left unchanged'
			});
			continue;
		}

		if (parseStoredAdapter(row.storageAdapter) === 'local') {
			if (flippedTracks.has(row.id)) {
				console.log(`[migrate-s3] resume skip flip ${row.id} (already in progress log)`);
			} else if (dryRun) {
				console.log(`[migrate-s3] would update track ${row.id} storageAdapter local → s3`);
			} else {
				await db
					.update(track)
					.set({ storageAdapter: 's3', updatedAt: new Date() })
					.where(and(eq(track.id, row.id), eq(track.storageAdapter, 'local')));
				dbUpdated += 1;
				flippedTracks.add(row.id);
				await appendProgress({
					phase: 'flip',
					status: 'ok',
					trackId: row.id,
					key: `${row.userId}/${row.folderKey}`
				});
				console.log(`[migrate-s3] track ${row.id} storageAdapter → s3`);
			}
		}

		if (purgeLocal) {
			for (const object of plan) {
				await maybePurge(object.localPath, object.key);
			}
		}
	}
}

async function migrateProfileAssets() {
	/** @type {import('drizzle-orm').SQL | undefined} */
	const userWhere = userFilter ? eq(profile.userId, userFilter) : undefined;

	const avatars = await db
		.select({ userId: profile.userId, filename: profile.avatarFilename })
		.from(profile)
		.where(userWhere);
	for (const row of avatars) {
		if (!row.filename) continue;
		const result = await migrateObject({
			userId: row.userId,
			folderKey: AVATAR_FOLDER_KEY,
			filename: row.filename,
			expectedSize: null,
			contentType: guessMime(row.filename),
			required: true,
			kind: 'avatar'
		});
		if (purgeLocal && result.status !== 'failed') await maybePurge(result.localPath, result.key);
	}

	const sites = await db
		.select({
			userId: site.userId,
			logoFilename: site.logoFilename,
			ogImageFilename: site.ogImageFilename
		})
		.from(site)
		.where(userFilter ? eq(site.userId, userFilter) : undefined);

	for (const row of sites) {
		if (row.logoFilename) {
			const result = await migrateObject({
				userId: row.userId,
				folderKey: SITE_LOGO_FOLDER_KEY,
				filename: row.logoFilename,
				expectedSize: null,
				contentType: guessMime(row.logoFilename),
				required: true,
				kind: 'site-logo'
			});
			if (purgeLocal && result.status !== 'failed') await maybePurge(result.localPath, result.key);
		}
		if (row.ogImageFilename) {
			const result = await migrateObject({
				userId: row.userId,
				folderKey: SITE_OG_FOLDER_KEY,
				filename: row.ogImageFilename,
				expectedSize: null,
				contentType: guessMime(row.ogImageFilename),
				required: true,
				kind: 'site-og'
			});
			if (purgeLocal && result.status !== 'failed') await maybePurge(result.localPath, result.key);
		}
	}
}

async function migrateOrphans() {
	const root = path.resolve(MEDIA_ROOT);
	/** @type {string[]} */
	let users;
	try {
		users = await readdir(root);
	} catch {
		console.log(`[migrate-s3] MEDIA_ROOT missing or unreadable: ${root}`);
		return;
	}

	const sshRows = await db
		.select({ userId: track.userId, folderKey: track.folderKey })
		.from(track)
		.where(eq(track.storageAdapter, 'ssh'));
	const sshFolders = new Set(sshRows.map((row) => `${row.userId}/${row.folderKey}`));

	for (const userId of users) {
		if (userFilter && userId !== userFilter) continue;
		if (!isSafeSegment(userId)) continue;
		const userDir = path.join(root, userId);
		const userStat = await stat(userDir).catch(() => null);
		if (!userStat?.isDirectory()) continue;

		const folders = await readdir(userDir).catch(() => []);
		for (const folderKey of folders) {
			if (!isSafeSegment(folderKey)) continue;
			if (sshFolders.has(`${userId}/${folderKey}`)) continue;
			const folderDir = path.join(root, userId, folderKey);
			const folderStat = await stat(folderDir).catch(() => null);
			if (!folderStat?.isDirectory()) continue;

			const files = await readdir(folderDir).catch(() => []);
			for (const filename of files) {
				if (!isSafeSegment(filename)) continue;
				const key = s3ObjectKey(userId, folderKey, filename);
				if (seenKeys.has(key)) continue;

				const result = await migrateObject({
					userId,
					folderKey,
					filename,
					expectedSize: null,
					contentType: guessMime(filename),
					required: false,
					kind: ASSET_FOLDERS.has(folderKey) ? 'asset-orphan' : 'orphan'
				});
				if (purgeLocal && result.status !== 'failed')
					await maybePurge(result.localPath, result.key);
			}
		}
	}
}

/**
 * @param {typeof track.$inferSelect} row
 */
function trackObjects(row) {
	/** @type {{ filename: string, expectedSize: number | null, contentType: string, required: boolean }[]} */
	const objects = [
		{
			filename: row.audioFilename,
			expectedSize: row.audioBytes,
			contentType: row.audioMime || guessMime(row.audioFilename),
			required: true
		}
	];
	if (row.originalFilename) {
		objects.push({
			filename: row.originalFilename,
			expectedSize: row.originalBytes,
			contentType: row.originalMime || guessMime(row.originalFilename),
			required: true
		});
	}
	if (row.coverFilename) {
		objects.push({
			filename: row.coverFilename,
			expectedSize: row.coverBytes,
			contentType: row.coverMime || guessMime(row.coverFilename),
			required: true
		});
	}
	objects.push({
		filename: WAVEFORM_FILENAME,
		expectedSize: null,
		contentType: 'application/json',
		required: false
	});
	return objects;
}

/**
 * @param {{
 *   userId: string,
 *   folderKey: string,
 *   filename: string,
 *   expectedSize: number | null,
 *   contentType: string,
 *   required: boolean,
 *   kind: string
 * }} input
 * @returns {Promise<{ status: 'ok' | 'failed' | 'skipped', key: string | null, localPath: string | null }>}
 */
async function migrateObject(input) {
	let key;
	try {
		key = s3ObjectKey(input.userId, input.folderKey, input.filename);
	} catch (err) {
		const reason = err instanceof Error ? err.message : 'invalid storage key';
		failures.push({
			key: `${input.userId}/${input.folderKey}/${input.filename}`,
			kind: input.kind,
			reason
		});
		await appendProgress({
			phase: 'fail',
			status: 'failed',
			key: `${input.userId}/${input.folderKey}/${input.filename}`,
			reason
		});
		return { status: 'failed', key: null, localPath: null };
	}

	if (seenKeys.has(key)) {
		return {
			status: 'ok',
			key,
			localPath: localPathFor(input.userId, input.folderKey, input.filename)
		};
	}
	seenKeys.add(key);
	considered += 1;

	if (verifiedKeys.has(key)) {
		verifiedExisting += 1;
		console.log(`[migrate-s3] resume skip ${key} (verified in progress log)`);
		return {
			status: 'ok',
			key,
			localPath: localPathFor(input.userId, input.folderKey, input.filename)
		};
	}

	const localPath = localPathFor(input.userId, input.folderKey, input.filename);
	const localInfo = await localFileInfo(localPath);

	try {
		if (localInfo && hasExpectedSize(input.expectedSize) && localInfo.size !== input.expectedSize) {
			const reason = `local size ${localInfo.size} != DB expectedSize ${input.expectedSize}; not uploading as truth`;
			failures.push({ key, kind: input.kind, reason });
			await appendProgress({ phase: 'fail', status: 'failed', key, kind: input.kind, reason });
			console.error(`[migrate-s3] FAIL ${key}: ${reason}`);
			return { status: 'failed', key, localPath };
		}

		const remote = await headS3Object(key);

		if (localInfo) {
			if (remote && isMultipartEtag(remote.etag)) {
				console.warn(
					`[migrate-s3] multipart ETag on ${key} (etag=${remote.etag}); cannot MD5-verify, will re-upload`
				);
			}
			const match = remote && objectMatches(remote, localInfo.size, localInfo.md5);
			if (match) {
				verifiedExisting += 1;
				verifiedKeys.add(key);
				await appendProgress({ phase: 'verify', status: 'ok', key, kind: input.kind });
				console.log(`[migrate-s3] exists ${key} (${localInfo.size} bytes)`);
				return { status: 'ok', key, localPath };
			}

			if (dryRun) {
				console.log(`[migrate-s3] would upload ${key} (${localInfo.size} bytes)`);
				return { status: 'ok', key, localPath };
			}

			const put = await putS3ObjectFromFile(key, localPath, input.contentType);
			const after = await headS3Object(key);
			if (!after || !objectMatches(after, put.size, put.md5)) {
				const reason = after
					? verifyFailureReason(after, put.size, put.md5)
					: 'verify failed: object missing after put';
				failures.push({ key, kind: input.kind, reason });
				return { status: 'failed', key, localPath };
			}
			uploaded += 1;
			verifiedKeys.add(key);
			await appendProgress({ phase: 'copy', status: 'ok', key, kind: input.kind });
			await appendProgress({ phase: 'verify', status: 'ok', key, kind: input.kind });
			console.log(`[migrate-s3] uploaded ${key} (${put.size} bytes)`);
			return { status: 'ok', key, localPath };
		}

		if (remote && (input.expectedSize == null || remote.size === input.expectedSize)) {
			if (isMultipartEtag(remote.etag)) {
				const reason = `remote-only object has multipart ETag (${remote.etag}); no local MD5 to verify`;
				failures.push({ key, kind: input.kind, reason });
				console.error(`[migrate-s3] FAIL ${key}: ${reason}`);
				return { status: 'failed', key, localPath: null };
			}
			verifiedExisting += 1;
			verifiedKeys.add(key);
			await appendProgress({ phase: 'verify', status: 'ok', key, kind: input.kind });
			console.log(`[migrate-s3] remote-only ${key} (${remote.size} bytes)`);
			return { status: 'ok', key, localPath: null };
		}

		if (!input.required) {
			skipped.push({ key, kind: input.kind, reason: 'optional local file missing' });
			return { status: 'skipped', key, localPath: null };
		}

		failures.push({
			key,
			kind: input.kind,
			reason: remote
				? `local missing and S3 size ${remote.size} != expected ${input.expectedSize}`
				: 'local file missing and object not on S3'
		});
		return { status: 'failed', key, localPath: null };
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		failures.push({ key, kind: input.kind, reason });
		return { status: 'failed', key, localPath };
	}
}

/** @param {number | null | undefined} value */
function hasExpectedSize(value) {
	return typeof value === 'number' && Number.isFinite(value);
}

/** @param {string | null | undefined} etag */
function isMultipartEtag(etag) {
	return Boolean(etag && etag.includes('-'));
}

/**
 * Size must match. When we have an MD5 (local file), ETag must be the
 * single-part MD5 — multipart ETags (`…-N`) are never a checksum pass.
 *
 * @param {{ size: number, etag: string | null }} remote
 * @param {number} size
 * @param {string} [md5]
 */
function objectMatches(remote, size, md5) {
	if (remote.size !== size) return false;
	if (!md5) return !isMultipartEtag(remote.etag);
	if (!remote.etag || isMultipartEtag(remote.etag)) return false;
	return remote.etag.toLowerCase() === md5.toLowerCase();
}

/**
 * @param {{ size: number, etag: string | null }} remote
 * @param {number} size
 * @param {string} md5
 */
function verifyFailureReason(remote, size, md5) {
	if (isMultipartEtag(remote.etag)) {
		return `verify failed: multipart ETag ${remote.etag} cannot be checked against MD5 ${md5}`;
	}
	return `verify failed size=${remote.size} etag=${remote.etag} expected=${size}/${md5}`;
}

/**
 * @param {string | null} localPath
 * @param {string | null} key
 */
async function maybePurge(localPath, key) {
	if (!localPath || dryRun) {
		if (dryRun && localPath) console.log(`[migrate-s3] would purge ${localPath}`);
		return;
	}
	try {
		await rm(localPath, { force: true });
		purged += 1;
		console.log(`[migrate-s3] purged ${localPath}${key ? ` (${key})` : ''}`);
	} catch (err) {
		failures.push({
			key: key ?? localPath,
			kind: 'purge',
			reason: err instanceof Error ? err.message : String(err)
		});
	}
}

/**
 * @param {string} userId
 * @param {string} folderKey
 * @param {string} filename
 */
function localPathFor(userId, folderKey, filename) {
	return path.join(path.resolve(MEDIA_ROOT), userId, folderKey, filename);
}

/**
 * @param {string} filePath
 * @returns {Promise<{ size: number, md5: string } | null>}
 */
async function localFileInfo(filePath) {
	try {
		const info = await stat(filePath);
		if (!info.isFile()) return null;
		const md5 = await md5FileHex(filePath);
		return { size: info.size, md5 };
	} catch {
		return null;
	}
}

/**
 * @param {string} filename
 */
function guessMime(filename) {
	if (filename === WAVEFORM_FILENAME) return 'application/json';
	const ext = path.extname(filename).toLowerCase();
	/** @type {Record<string, string>} */
	const map = {
		'.mp3': 'audio/mpeg',
		'.wav': 'audio/wav',
		'.flac': 'audio/flac',
		'.ogg': 'audio/ogg',
		'.oga': 'audio/ogg',
		'.m4a': 'audio/mp4',
		'.aac': 'audio/aac',
		'.aiff': 'audio/aiff',
		'.aif': 'audio/aiff',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.webp': 'image/webp',
		'.gif': 'image/gif',
		'.json': 'application/json'
	};
	return map[ext] || 'application/octet-stream';
}

/** @param {string} value */
function isSafeSegment(value) {
	try {
		assertSafeStorageSegment(value, 'path');
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
	/** @type {Set<string>} */
	const flags = new Set();
	/** @type {Map<string, string>} */
	const opts = new Map();
	for (let i = 0; i < argv.length; i++) {
		const token = argv[i];
		if (token === '--dry-run' || token === '--purge-local' || token === '--apply') {
			flags.add(token);
			continue;
		}
		if (
			token === '--user' ||
			token === '--limit' ||
			token === '--track' ||
			token === '--report' ||
			token === '--progress' ||
			token === '--inventory'
		) {
			const value = argv[i + 1];
			if (!value || value.startsWith('--')) die(`${token} needs a value.`);
			opts.set(token, value);
			i += 1;
			continue;
		}
		if (token === '--help' || token === '-h') {
			console.log(
				`Usage: bun run media:migrate-s3 -- [--apply] [--dry-run] [--purge-local] [--user id] [--track id] [--limit n] [--report path] [--progress path] [--inventory path]\nDefault is a dry-run. --apply copies / verifies / flips. --purge-local is opt-in and requires --apply.`
			);
			process.exit(0);
		}
		die(`Unknown argument: ${token}`);
	}
	return { flags, opts };
}

/**
 * @param {string} filePath
 * @returns {Promise<{ verifiedKeys: Set<string>, flippedTracks: Set<string> }>}
 */
async function loadProgress(filePath) {
	/** @type {Set<string>} */
	const verified = new Set();
	/** @type {Set<string>} */
	const flipped = new Set();
	try {
		const text = await readFile(filePath, 'utf8');
		for (const line of text.split('\n')) {
			if (!line.trim()) continue;
			try {
				const event = JSON.parse(line);
				if (event.phase === 'verify' && event.status === 'ok' && event.key) {
					verified.add(event.key);
				}
				if (event.phase === 'flip' && event.status === 'ok' && event.trackId) {
					flipped.add(event.trackId);
				}
			} catch {
				console.warn(`[migrate-s3] ignoring malformed progress line`);
			}
		}
		if (verified.size || flipped.size) {
			console.log(
				`[migrate-s3] resumed ${verified.size} verified objects, ${flipped.size} flipped tracks from ${filePath}`
			);
		}
	} catch {
		// First run — no progress file yet.
	}
	return { verifiedKeys: verified, flippedTracks: flipped };
}

/**
 * @param {Record<string, unknown>} event
 */
async function appendProgress(event) {
	const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n';
	await appendFile(progressPath, line);
}

/** @param {string} message */
function die(message) {
	console.error(`[migrate-s3] ${message}`);
	process.exit(1);
}
