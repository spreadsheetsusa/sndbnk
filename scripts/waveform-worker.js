/**
 * BullMQ worker: generate track.waveform peaks off the HTTP process.
 *
 *   bun run worker:waveform
 *
 * Requires REDIS_URL, DATABASE_URL, MEDIA_ROOT (and STORAGE_SECRET for SSH tracks).
 * Runs under raw Bun (not Vite), so `#lib/…` imports in this dependency tree must
 * include `.js` / `index.js` — Bun’s package `imports` map does not resolve
 * extensionless specifiers the way Vite does.
 */
import { Worker } from 'bullmq';

import { processWaveformJob, WAVEFORM_QUEUE_NAME } from '../src/lib/server/queue/waveform.js';
import { createRedisConnection, getRedisUrl } from '../src/lib/server/queue/redis.js';
import { WAVEFORM_WORKER_TIMEOUT_MS } from '../src/lib/server/media/waveform.js';

const redisUrl = getRedisUrl();
if (!redisUrl) {
	console.error('[waveform-worker] REDIS_URL is not set; exiting.');
	process.exit(1);
}

const connection = createRedisConnection();
if (!connection) {
	console.error('[waveform-worker] could not connect to Redis; exiting.');
	process.exit(1);
}

const worker = new Worker(
	WAVEFORM_QUEUE_NAME,
	async (job) => {
		const trackId = job.data?.trackId;
		if (typeof trackId !== 'string' || !trackId) {
			throw new Error('Job missing trackId');
		}
		console.log(`[waveform-worker] start ${trackId} (attempt ${job.attemptsMade + 1})`);
		await processWaveformJob(trackId);
	},
	{
		connection,
		concurrency: 1,
		lockDuration: WAVEFORM_WORKER_TIMEOUT_MS + 60_000
	}
);

worker.on('completed', (job) => {
	console.log(`[waveform-worker] completed ${job.id}`);
});

worker.on('failed', (job, err) => {
	console.error(`[waveform-worker] failed ${job?.id ?? '?'}: ${err.message}`);
});

worker.on('error', (err) => {
	console.error(`[waveform-worker] error: ${err.message}`);
});

console.log(`[waveform-worker] listening on queue "${WAVEFORM_QUEUE_NAME}" (${redisUrl})`);

async function shutdown(signal) {
	console.log(`[waveform-worker] ${signal}; closing…`);
	await worker.close();
	connection.disconnect();
	process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
