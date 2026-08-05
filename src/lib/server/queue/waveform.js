import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';

import { db } from '#lib/server/db/index.js';
import { track } from '#lib/server/db/schema.js';
import {
	generateWaveformPeaksFromPath,
	parseWaveform,
	WAVEFORM_WORKER_TIMEOUT_MS
} from '#lib/server/media/waveform.js';
import { createRedisConnection, getRedisUrl } from '#lib/server/queue/redis.js';
import { getStorageAdapter } from '#lib/server/storage/index.js';
import { localTrackFilePath } from '#lib/server/storage/local-path.js';

export const WAVEFORM_QUEUE_NAME = 'waveform';

/** @type {Queue | null | undefined} */
let queueSingleton;

/**
 * @returns {Queue | null}
 */
function getWaveformQueue() {
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
	queueSingleton = new Queue(WAVEFORM_QUEUE_NAME, { connection });
	return queueSingleton;
}

/**
 * Enqueue peak generation for a track. Fail-soft: missing Redis or enqueue
 * errors are logged and never fail the caller (upload still succeeds).
 *
 * @param {string} trackId
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function enqueueWaveformJob(trackId) {
	const queue = getWaveformQueue();
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
			// completed (or unknown): remove so a fresh backfill can run
			await existing.remove();
		}

		await queue.add(
			'generate',
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
		console.error(`[waveform-queue] enqueue failed for ${trackId}: ${message}`);
		return { ok: false, reason: 'enqueue-failed' };
	}
}

/**
 * Worker processor: load audio from storage, write peaks onto the track row.
 *
 * @param {string} trackId
 */
export async function processWaveformJob(trackId) {
	const rows = await db.select().from(track).where(eq(track.id, trackId)).limit(1);
	const row = rows[0];
	if (!row) {
		console.error(`[waveform-queue] track not found: ${trackId}`);
		return;
	}

	if (parseWaveform(row.waveform)) return;

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

			tempDir = await mkdtemp(path.join(tmpdir(), 'sndbnk-waveform-job-'));
			const ext = path.extname(row.audioFilename).replace(/^\./, '') || 'bin';
			inputPath = path.join(tempDir, `input.${ext}`);
			await writeFile(inputPath, bytes);
		}

		const peaks = await generateWaveformPeaksFromPath(inputPath, {
			timeoutMs: WAVEFORM_WORKER_TIMEOUT_MS
		});
		if (!peaks) {
			throw new Error('Peak generation returned null');
		}

		await db
			.update(track)
			.set({ waveform: JSON.stringify(peaks), updatedAt: new Date() })
			.where(eq(track.id, trackId));

		console.log(`[waveform-queue] peaks ready for ${trackId} (${peaks.length} buckets)`);
	} finally {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true }).catch(() => {});
		}
	}
}
