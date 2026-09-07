import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';

import { db } from '#lib/server/db/index.js';
import { track } from '#lib/server/db/schema.js';
import {
	audioColumnsFromStream,
	casTrackMedia,
	discardStaleObject,
	extFromFilename,
	playbackObjectName,
	resolveMasterSource,
	trackNeedsPlaybackMp3
} from '#lib/server/media/assets.js';
import {
	encodeToPlaybackMp3,
	PLAYBACK_MP3_MIME,
	TRANSCODE_WORKER_TIMEOUT_MS
} from '#lib/server/media/transcode.js';
import { checkUploadAllowed } from '#lib/server/quota.js';
import { createRedisConnection, getRedisUrl } from '#lib/server/queue/redis.js';
import {
	getStorageAdapter,
	isHostedStorageAdapter,
	parseStoredAdapter
} from '#lib/server/storage/index.js';
import { localTrackFilePath } from '#lib/server/storage/local-path.js';
import { stageAdapterObjectToFile } from '#lib/server/storage/stage.js';

export const TRANSCODE_QUEUE_NAME = 'transcode';

/** @type {Queue | null | undefined} */
let queueSingleton;

/**
 * @returns {Queue | null}
 */
function getTranscodeQueue() {
	if (queueSingleton !== undefined) return queueSingleton;
	if (!getRedisUrl()) {
		queueSingleton = null;
		return null;
	}
	const connection = createRedisConnection();
	if (!connection) {
		queueSingleton = null;
		return null;
	}
	queueSingleton = new Queue(TRANSCODE_QUEUE_NAME, { connection });
	return queueSingleton;
}

/**
 * @param {string} trackId
 * @param {string} revision
 */
export function transcodeJobId(trackId, revision) {
	return `${trackId}:${revision}:playback`;
}

/**
 * Enqueue a 320k MP3 playback encode. Fail-soft: missing Redis or enqueue
 * errors are logged and never fail the caller (upload still succeeds).
 *
 * @param {string} trackId
 * @param {string} [revision]
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function enqueueTranscodeJob(trackId, revision) {
	const queue = getTranscodeQueue();
	if (!queue) return { ok: false, reason: 'redis-unconfigured' };

	let rev = revision;
	if (!rev) {
		const rows = await db
			.select({ mediaRevision: track.mediaRevision })
			.from(track)
			.where(eq(track.id, trackId))
			.limit(1);
		rev = rows[0]?.mediaRevision ?? '';
	}
	if (!rev) return { ok: false, reason: 'missing-revision' };

	const jobId = transcodeJobId(trackId, rev);

	try {
		const existing = await queue.getJob(jobId);
		if (existing) {
			const state = await existing.getState();
			if (state === 'waiting' || state === 'active' || state === 'delayed' || state === 'paused') {
				return { ok: true };
			}
			if (state === 'failed') {
				await existing.retry();
				return { ok: true };
			}
			await existing.remove();
		}

		await queue.add(
			'playback-mp3',
			{ trackId, revision: rev, role: 'playback' },
			{
				jobId,
				attempts: 3,
				backoff: { type: 'exponential', delay: 5_000 },
				removeOnComplete: 100,
				removeOnFail: 50
			}
		);
		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[transcode-queue] enqueue failed for ${trackId}: ${message}`);
		return { ok: false, reason: 'enqueue-failed' };
	}
}

/**
 * @param {typeof track.$inferSelect} row
 * @param {string} message
 */
async function markPlaybackFailed(row, message) {
	const published = await casTrackMedia(row.id, row.mediaRevision, {
		playbackStatus: 'failed',
		playbackError: message,
		playbackUpdatedAt: new Date()
	});
	if (!published) {
		console.log(`[transcode-queue] stale fail mark discarded for ${row.id}:${row.mediaRevision}`);
	}
}

/**
 * Worker processor: encode master → 320k MP3, CAS-publish playback columns.
 *
 * @param {string} trackId
 * @param {string} [revision]
 */
export async function processTranscodeJob(trackId, revision) {
	const rows = await db.select().from(track).where(eq(track.id, trackId)).limit(1);
	const row = rows[0];
	if (!row) {
		console.error(`[transcode-queue] track not found: ${trackId}`);
		return;
	}

	if (revision && row.mediaRevision !== revision) {
		console.log(
			`[transcode-queue] skip ${trackId}: stale revision ${revision} (now ${row.mediaRevision})`
		);
		return;
	}

	if (!trackNeedsPlaybackMp3(row)) {
		console.log(`[transcode-queue] skip ${trackId}: no playback convert needed`);
		return;
	}

	const master = resolveMasterSource(row);
	if (!master) {
		await markPlaybackFailed(row, 'Master audio is missing.');
		return;
	}

	/** @type {string | null} */
	let tempDir = null;
	/** @type {string} */
	let inputPath;
	const playbackName = playbackObjectName(row.mediaRevision, 'mp3');

	try {
		if (parseStoredAdapter(row.storageAdapter) === 'local') {
			inputPath = localTrackFilePath(row.userId, row.folderKey, master.filename);
			if (!(await Bun.file(inputPath).exists())) {
				throw new Error(`Local master missing: ${inputPath}`);
			}
		} else {
			const storage = await getStorageAdapter(row.userId, parseStoredAdapter(row.storageAdapter));
			tempDir = await mkdtemp(path.join(tmpdir(), 'sndbnk-transcode-job-'));
			const ext = extFromFilename(master.filename) || 'bin';
			inputPath = path.join(tempDir, `input.${ext}`);
			await stageAdapterObjectToFile(storage, row.folderKey, master.filename, inputPath);
		}

		if (!tempDir) {
			tempDir = await mkdtemp(path.join(tmpdir(), 'sndbnk-transcode-out-'));
		}
		const outputPath = path.join(tempDir, playbackName);

		const encoded = await encodeToPlaybackMp3(inputPath, outputPath, {
			timeoutMs: TRANSCODE_WORKER_TIMEOUT_MS
		});
		if (!encoded.ok) {
			await markPlaybackFailed(row, encoded.message);
			throw new Error(encoded.message);
		}

		if (isHostedStorageAdapter(parseStoredAdapter(row.storageAdapter))) {
			const quota = await checkUploadAllowed(row.userId, {
				newTrack: false,
				addedBytes: encoded.bytes,
				adapter: row.storageAdapter,
				replacesBytes: 0
			});
			if (!quota.ok) {
				await markPlaybackFailed(row, quota.message);
				return;
			}
		}

		const storage = await getStorageAdapter(row.userId, parseStoredAdapter(row.storageAdapter));
		const mp3Bytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer());
		await storage.put(row.folderKey, playbackName, mp3Bytes, PLAYBACK_MP3_MIME);

		const stream = {
			filename: playbackName,
			mime: PLAYBACK_MP3_MIME,
			bytes: encoded.bytes
		};
		const published = await casTrackMedia(row.id, row.mediaRevision, {
			playbackFilename: playbackName,
			playbackMime: PLAYBACK_MP3_MIME,
			playbackBytes: encoded.bytes,
			playbackStatus: 'ready',
			playbackError: null,
			playbackUpdatedAt: new Date(),
			...audioColumnsFromStream(row, stream)
		});

		if (!published) {
			await discardStaleObject(storage, row.folderKey, playbackName);
			console.log(`[transcode-queue] stale playback discarded for ${trackId}:${row.mediaRevision}`);
			return;
		}

		console.log(
			`[transcode-queue] playback ready for ${trackId} (${encoded.bytes} bytes; master ${master.filename})`
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (!message.includes('ffmpeg encode')) {
			await markPlaybackFailed(row, message);
		}
		throw err;
	} finally {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true }).catch(() => {});
		}
	}
}
