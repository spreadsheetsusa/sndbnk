import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';

import { db } from '#lib/server/db/index.js';
import { track } from '#lib/server/db/schema.js';
import {
	encodeToPlaybackMp3,
	PLAYBACK_MP3_FILENAME,
	PLAYBACK_MP3_MIME,
	trackNeedsPlaybackMp3,
	TRANSCODE_WORKER_TIMEOUT_MS
} from '#lib/server/media/transcode.js';
import { createRedisConnection, getRedisUrl } from '#lib/server/queue/redis.js';
import { getStorageAdapter } from '#lib/server/storage/index.js';
import { localTrackFilePath } from '#lib/server/storage/local-path.js';

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
 * Enqueue WAV→MP3 playback encode. Fail-soft: missing Redis or enqueue
 * errors are logged and never fail the caller (upload still succeeds; WAV plays).
 *
 * @param {string} trackId
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function enqueueTranscodeJob(trackId) {
	const queue = getTranscodeQueue();
	if (!queue) return { ok: false, reason: 'redis-unconfigured' };

	try {
		const existing = await queue.getJob(trackId);
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
			'wav-to-mp3',
			{ trackId },
			{
				jobId: trackId,
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
 * Worker processor: encode WAV to MP3, store beside the original, point
 * audio* at the MP3 and original* at the preserved WAV.
 *
 * @param {string} trackId
 */
export async function processTranscodeJob(trackId) {
	const rows = await db.select().from(track).where(eq(track.id, trackId)).limit(1);
	const row = rows[0];
	if (!row) {
		console.error(`[transcode-queue] track not found: ${trackId}`);
		return;
	}

	if (!trackNeedsPlaybackMp3(row)) {
		console.log(`[transcode-queue] skip ${trackId}: no WAV playback convert needed`);
		return;
	}

	/** @type {string | null} */
	let tempDir = null;
	/** @type {string} */
	let inputPath;

	try {
		if (row.storageAdapter === 'local') {
			inputPath = localTrackFilePath(row.userId, row.folderKey, row.audioFilename);
			if (!(await Bun.file(inputPath).exists())) {
				throw new Error(`Local audio missing: ${inputPath}`);
			}
		} else {
			const storage = await getStorageAdapter(
				row.userId,
				/** @type {'local' | 'ssh'} */ (row.storageAdapter)
			);
			const object = await storage.get(row.folderKey, row.audioFilename);
			const bytes =
				object.body instanceof Uint8Array
					? object.body
					: new Uint8Array(await new Response(/** @type {BodyInit} */ (object.body)).arrayBuffer());

			tempDir = await mkdtemp(path.join(tmpdir(), 'sndbnk-transcode-job-'));
			const ext = path.extname(row.audioFilename).replace(/^\./, '') || 'wav';
			inputPath = path.join(tempDir, `input.${ext}`);
			await writeFile(inputPath, bytes);
		}

		if (!tempDir) {
			tempDir = await mkdtemp(path.join(tmpdir(), 'sndbnk-transcode-out-'));
		}
		const outputPath = path.join(tempDir, PLAYBACK_MP3_FILENAME);

		const encoded = await encodeToPlaybackMp3(inputPath, outputPath, {
			timeoutMs: TRANSCODE_WORKER_TIMEOUT_MS
		});
		if (!encoded.ok) {
			throw new Error(encoded.message);
		}

		const storage = await getStorageAdapter(
			row.userId,
			/** @type {'local' | 'ssh'} */ (row.storageAdapter)
		);
		const mp3Bytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer());
		await storage.put(row.folderKey, PLAYBACK_MP3_FILENAME, mp3Bytes, PLAYBACK_MP3_MIME);

		await db
			.update(track)
			.set({
				originalFilename: row.audioFilename,
				originalMime: row.audioMime,
				originalBytes: row.audioBytes,
				audioFilename: PLAYBACK_MP3_FILENAME,
				audioMime: PLAYBACK_MP3_MIME,
				audioBytes: encoded.bytes,
				updatedAt: new Date()
			})
			.where(eq(track.id, trackId));

		console.log(
			`[transcode-queue] mp3 ready for ${trackId} (${encoded.bytes} bytes; kept ${row.audioFilename})`
		);
	} finally {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true }).catch(() => {});
		}
	}
}
