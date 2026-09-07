import { Queue } from 'bullmq';
import { and, eq } from 'drizzle-orm';

import { parseTagEmbedStatus } from '#lib/media/tag-embed-status.js';
import { db } from '#lib/server/db/index.js';
import { track } from '#lib/server/db/schema.js';
import { embedTrackTags } from '#lib/server/media/embed-tags.js';
import { createRedisConnection, getRedisUrl } from '#lib/server/queue/redis.js';

export const EMBED_TAGS_QUEUE_NAME = 'embed-tags';

/** 100MB typical; 15 min matches waveform/transcode so a slow S3/SSH hop cannot stall the lock. */
export const EMBED_TAGS_WORKER_TIMEOUT_MS = 15 * 60 * 1000;

/** @typedef {import('#lib/media/tag-embed-status.js').TagEmbedStatus} TagEmbedStatus */

/** @typedef {'gapfill' | 'overwrite'} TagEmbedMode */

/** @type {Queue | null | undefined} */
let queueSingleton;

/**
 * @returns {Queue | null}
 */
function getEmbedTagsQueue() {
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
	queueSingleton = new Queue(EMBED_TAGS_QUEUE_NAME, { connection });
	return queueSingleton;
}

export { parseTagEmbedStatus };

/**
 * @param {unknown} value
 * @returns {TagEmbedMode}
 */
export function parseTagEmbedMode(value) {
	return value === 'overwrite' ? 'overwrite' : 'gapfill';
}

/**
 * @param {string} userId
 * @param {string} trackId
 * @param {TagEmbedStatus} status
 * @param {string} message
 */
async function setTagEmbedStatus(userId, trackId, status, message) {
	await db
		.update(track)
		.set({
			tagEmbedStatus: status,
			tagEmbedMessage: message,
			tagEmbedUpdatedAt: new Date()
		})
		.where(and(eq(track.id, trackId), eq(track.userId, userId)));
}

/**
 * @param {string} userId
 * @param {string} trackId
 * @returns {Promise<{ status: TagEmbedStatus | null, message: string | null, updatedAt: number | null }>}
 */
export async function getTagEmbedJobStatus(userId, trackId) {
	const rows = await db
		.select({
			tagEmbedStatus: track.tagEmbedStatus,
			tagEmbedMessage: track.tagEmbedMessage,
			tagEmbedUpdatedAt: track.tagEmbedUpdatedAt
		})
		.from(track)
		.where(and(eq(track.id, trackId), eq(track.userId, userId)))
		.limit(1);
	const row = rows[0];
	if (!row) {
		return { status: null, message: null, updatedAt: null };
	}
	return {
		status: parseTagEmbedStatus(row.tagEmbedStatus),
		message: row.tagEmbedMessage ?? null,
		updatedAt: row.tagEmbedUpdatedAt?.getTime() ?? null
	};
}

/**
 * Enqueue a write-tags job. Dedupes in-flight work per track.
 *
 * @param {string} userId
 * @param {string} trackId
 * @param {{ mode?: TagEmbedMode }} [options]
 * @returns {Promise<
 *   | { ok: true, status: TagEmbedStatus, message: string }
 *   | { ok: false, reason: string, message: string }
 * >}
 */
export async function enqueueEmbedTagsJob(userId, trackId, { mode = 'gapfill' } = {}) {
	const queue = getEmbedTagsQueue();
	if (!queue) {
		return {
			ok: false,
			reason: 'redis-unconfigured',
			message: 'Tag writing is unavailable. The media worker is not running.'
		};
	}

	const queuedMessage = 'Writing tags to the file…';

	try {
		const existing = await queue.getJob(trackId);
		if (existing) {
			const state = await existing.getState();
			if (state === 'waiting' || state === 'active' || state === 'delayed' || state === 'paused') {
				const current = await getTagEmbedJobStatus(userId, trackId);
				const status = current.status === 'writing' ? 'writing' : 'queued';
				if (!current.status) {
					await setTagEmbedStatus(userId, trackId, status, queuedMessage);
				}
				return { ok: true, status, message: current.message ?? queuedMessage };
			}
			await existing.remove();
		}

		await setTagEmbedStatus(userId, trackId, 'queued', queuedMessage);

		await queue.add(
			'embed-tags',
			{ trackId, userId, mode },
			{
				jobId: trackId,
				attempts: 3,
				backoff: { type: 'exponential', delay: 5_000 },
				removeOnComplete: 100,
				removeOnFail: 50
			}
		);
		return { ok: true, status: 'queued', message: queuedMessage };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[embed-tags-queue] enqueue failed for ${trackId}: ${message}`);
		await setTagEmbedStatus(
			userId,
			trackId,
			'failed',
			'Could not queue tag writing. Try again in a moment.'
		).catch(() => {});
		return {
			ok: false,
			reason: 'enqueue-failed',
			message: 'Could not queue tag writing. Try again in a moment.'
		};
	}
}

/**
 * @param {{ written: string[] }} result
 */
function doneMessage(result) {
	if (result.written.length === 0) {
		return 'No tags were written to the file.';
	}
	return `Wrote tags: ${result.written.join(', ')}.`;
}

/**
 * Worker processor: write saved metadata into the audio file, then record status.
 *
 * @param {string} trackId
 * @param {string} userId
 * @param {TagEmbedMode} [mode]
 */
export async function processEmbedTagsJob(trackId, userId, mode = 'gapfill') {
	const rows = await db
		.select({ id: track.id, userId: track.userId })
		.from(track)
		.where(and(eq(track.id, trackId), eq(track.userId, userId)))
		.limit(1);
	if (!rows[0]) {
		console.error(`[embed-tags-queue] track not found: ${trackId}`);
		return;
	}

	await setTagEmbedStatus(userId, trackId, 'writing', 'Writing tags to the file…');

	try {
		const result = await embedTrackTags(userId, trackId, { mode });
		if (result.ok) {
			await setTagEmbedStatus(userId, trackId, 'done', doneMessage(result));
			console.log(`[embed-tags-queue] ${trackId} wrote ${result.written.length} tag(s) (${mode})`);
			return;
		}

		// User-facing result (unsupported format, gapfill abort, nothing to write).
		// Do not throw — retrying will not change the file.
		await setTagEmbedStatus(userId, trackId, 'failed', result.message);
		console.error(`[embed-tags-queue] ${trackId}: ${result.message}`);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Could not write tags into this audio file.';
		await setTagEmbedStatus(userId, trackId, 'failed', message);
		throw err;
	}
}
