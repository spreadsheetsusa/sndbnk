import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';

import { db } from '#lib/server/db/index.js';
import { track } from '#lib/server/db/schema.js';
import {
	casTrackMedia,
	extFromFilename,
	resolveMasterSource,
	waveformObjectName
} from '#lib/server/media/assets.js';
import {
	generateWaveformPeaksFromPath,
	parseWaveform,
	WAVEFORM_FILENAME,
	WAVEFORM_WORKER_TIMEOUT_MS
} from '#lib/server/media/waveform.js';
import { createRedisConnection, getRedisUrl } from '#lib/server/queue/redis.js';
import { getStorageAdapter, parseStoredAdapter } from '#lib/server/storage/index.js';
import { localTrackFilePath } from '#lib/server/storage/local-path.js';
import { stageAdapterObjectToFile } from '#lib/server/storage/stage.js';

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
 * @param {string} trackId
 * @param {string} revision
 */
export function waveformJobId(trackId, revision) {
	return `${trackId}:${revision}:waveform`;
}

/**
 * Enqueue peak generation for a track. Fail-soft: missing Redis or enqueue
 * errors are logged and never fail the caller (upload still succeeds).
 *
 * @param {string} trackId
 * @param {string} [revision]
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function enqueueWaveformJob(trackId, revision) {
	const queue = getWaveformQueue();
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

	const jobId = rev ? waveformJobId(trackId, rev) : trackId;

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
			'generate',
			{ trackId, revision: rev || null, role: 'waveform' },
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
		console.error(`[waveform-queue] enqueue failed for ${trackId}: ${message}`);
		return { ok: false, reason: 'enqueue-failed' };
	}
}

/**
 * Write peaks beside audio/cover. Fail-soft so a storage blip never fails the job
 * after DB peaks are already saved.
 *
 * @param {typeof track.$inferSelect} row
 * @param {number[]} peaks
 */
async function putWaveformFile(row, peaks) {
	const filename = row.mediaRevision ? waveformObjectName(row.mediaRevision) : WAVEFORM_FILENAME;
	try {
		const storage = await getStorageAdapter(row.userId, parseStoredAdapter(row.storageAdapter));
		const body = new TextEncoder().encode(JSON.stringify(peaks));
		await storage.put(row.folderKey, filename, body, 'application/json');
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[waveform-queue] storage put failed for ${row.id} (${filename}): ${message}`);
	}
}

/**
 * Worker processor: load master audio from storage, write peaks onto the track
 * row, and dual-write waveform-{revision}.json into the track folder.
 *
 * @param {string} trackId
 * @param {string} [revision]
 */
export async function processWaveformJob(trackId, revision) {
	const rows = await db.select().from(track).where(eq(track.id, trackId)).limit(1);
	const row = rows[0];
	if (!row) {
		console.error(`[waveform-queue] track not found: ${trackId}`);
		return;
	}

	if (revision && row.mediaRevision && row.mediaRevision !== revision) {
		console.log(
			`[waveform-queue] skip ${trackId}: stale revision ${revision} (now ${row.mediaRevision})`
		);
		return;
	}

	const existing = parseWaveform(row.waveform);
	if (existing) {
		await putWaveformFile(row, existing);
		return;
	}

	const master = resolveMasterSource(row);
	if (!master) {
		throw new Error('Master audio is missing');
	}

	/** @type {string | null} */
	let tempDir = null;
	/** @type {string} */
	let inputPath;

	try {
		if (parseStoredAdapter(row.storageAdapter) === 'local') {
			inputPath = localTrackFilePath(row.userId, row.folderKey, master.filename);
			if (!(await Bun.file(inputPath).exists())) {
				throw new Error(`Local audio missing: ${inputPath}`);
			}
		} else {
			const storage = await getStorageAdapter(row.userId, parseStoredAdapter(row.storageAdapter));
			tempDir = await mkdtemp(path.join(tmpdir(), 'sndbnk-waveform-job-'));
			const ext = extFromFilename(master.filename) || 'bin';
			inputPath = path.join(tempDir, `input.${ext}`);
			await stageAdapterObjectToFile(storage, row.folderKey, master.filename, inputPath);
		}

		const peaks = await generateWaveformPeaksFromPath(inputPath, {
			timeoutMs: WAVEFORM_WORKER_TIMEOUT_MS
		});
		if (!peaks) {
			throw new Error('Peak generation returned null');
		}

		if (revision && row.mediaRevision && row.mediaRevision !== revision) {
			console.log(`[waveform-queue] skip DB write ${trackId}: revision raced`);
			return;
		}

		const published = row.mediaRevision
			? await casTrackMedia(trackId, row.mediaRevision, { waveform: JSON.stringify(peaks) })
			: (
					await db
						.update(track)
						.set({ waveform: JSON.stringify(peaks), updatedAt: new Date() })
						.where(eq(track.id, trackId))
						.returning({ id: track.id })
				).length > 0;
		if (!published) {
			console.log(`[waveform-queue] skip DB write ${trackId}: CAS lost`);
			return;
		}

		await putWaveformFile(row, peaks);

		console.log(`[waveform-queue] peaks ready for ${trackId} (${peaks.length} buckets)`);
	} finally {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true }).catch(() => {});
		}
	}
}
