/**
 * BullMQ worker: generate track.waveform peaks and WAV→MP3 playback copies
 * off the HTTP process.
 *
 *   bun run worker:waveform
 *
 * Requires REDIS_URL, DATABASE_URL, MEDIA_ROOT (and STORAGE_SECRET for SSH tracks).
 * Runs under raw Bun (not Vite), so `#lib/…` imports in this dependency tree must
 * include `.js` / `index.js` — Bun’s package `imports` map does not resolve
 * extensionless specifiers the way Vite does.
 */
import { Worker } from 'bullmq';

import { TRANSCODE_WORKER_TIMEOUT_MS } from '../src/lib/server/media/transcode.js';
import { WAVEFORM_WORKER_TIMEOUT_MS } from '../src/lib/server/media/waveform.js';
import { createRedisConnection, getRedisUrl } from '../src/lib/server/queue/redis.js';
import { processTranscodeJob, TRANSCODE_QUEUE_NAME } from '../src/lib/server/queue/transcode.js';
import { processWaveformJob, WAVEFORM_QUEUE_NAME } from '../src/lib/server/queue/waveform.js';

const redisUrl = getRedisUrl();
if (!redisUrl) {
	console.error('[waveform-worker] REDIS_URL is not set; exiting.');
	process.exit(1);
}

// Each Worker needs its own Redis connection (blocking commands).
const waveformConnection = createRedisConnection();
const transcodeConnection = createRedisConnection();
if (!waveformConnection || !transcodeConnection) {
	console.error('[waveform-worker] could not connect to Redis; exiting.');
	process.exit(1);
}

/**
 * @param {string} label
 * @param {import('bullmq').Processor} processor
 * @param {string} queueName
 * @param {import('ioredis').default} connection
 * @param {number} lockExtraMs
 */
function startWorker(label, processor, queueName, connection, lockExtraMs) {
	const worker = new Worker(queueName, processor, {
		connection,
		concurrency: 1,
		lockDuration: lockExtraMs + 60_000
	});

	worker.on('completed', (job) => {
		console.log(`[${label}] completed ${job.id}`);
	});

	worker.on('failed', (job, err) => {
		console.error(`[${label}] failed ${job?.id ?? '?'}: ${err.message}`);
	});

	worker.on('error', (err) => {
		console.error(`[${label}] error: ${err.message}`);
	});

	return worker;
}

const waveformWorker = startWorker(
	'waveform-worker',
	async (job) => {
		const trackId = job.data?.trackId;
		if (typeof trackId !== 'string' || !trackId) {
			throw new Error('Job missing trackId');
		}
		console.log(`[waveform-worker] start ${trackId} (attempt ${job.attemptsMade + 1})`);
		await processWaveformJob(trackId);
	},
	WAVEFORM_QUEUE_NAME,
	waveformConnection,
	WAVEFORM_WORKER_TIMEOUT_MS
);

const transcodeWorker = startWorker(
	'transcode-worker',
	async (job) => {
		const trackId = job.data?.trackId;
		if (typeof trackId !== 'string' || !trackId) {
			throw new Error('Job missing trackId');
		}
		console.log(`[transcode-worker] start ${trackId} (attempt ${job.attemptsMade + 1})`);
		await processTranscodeJob(trackId);
	},
	TRANSCODE_QUEUE_NAME,
	transcodeConnection,
	TRANSCODE_WORKER_TIMEOUT_MS
);

console.log(
	`[waveform-worker] listening on queues "${WAVEFORM_QUEUE_NAME}" + "${TRANSCODE_QUEUE_NAME}" (${redisUrl})`
);

async function shutdown(signal) {
	console.log(`[waveform-worker] ${signal}; closing…`);
	await Promise.all([waveformWorker.close(), transcodeWorker.close()]);
	waveformConnection.disconnect();
	transcodeConnection.disconnect();
	process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
