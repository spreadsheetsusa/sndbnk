/**
 * BullMQ worker: generate track.waveform peaks, playback MP3 encodes,
 * and write-tags embeds off the HTTP process.
 *
 *   bun run worker:waveform
 *
 * Requires REDIS_URL, DATABASE_URL, MEDIA_ROOT (plus S3_* when platform S3 is
 * on, and STORAGE_SECRET for SSH tracks).
 * Runs under raw Bun (not Vite), so `#lib/…` imports in this dependency tree must
 * include `.js` / `index.js` — Bun’s package `imports` map does not resolve
 * extensionless specifiers the way Vite does.
 *
 * After deploy, restart `sndbnk-waveform-worker` so this process picks up the
 * embed-tags queue (same systemd unit; no new service).
 */
import { Worker } from 'bullmq';

import { TRANSCODE_WORKER_TIMEOUT_MS } from '../src/lib/server/media/transcode.js';
import { WAVEFORM_WORKER_TIMEOUT_MS } from '../src/lib/server/media/waveform.js';
import {
	EMBED_TAGS_QUEUE_NAME,
	EMBED_TAGS_WORKER_TIMEOUT_MS,
	parseTagEmbedMode,
	processEmbedTagsJob
} from '../src/lib/server/queue/embed-tags.js';
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
const embedTagsConnection = createRedisConnection();
if (!waveformConnection || !transcodeConnection || !embedTagsConnection) {
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
		const revision = typeof job.data?.revision === 'string' ? job.data.revision : undefined;
		console.log(`[waveform-worker] start ${trackId} (attempt ${job.attemptsMade + 1})`);
		await processWaveformJob(trackId, revision);
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
		const revision = typeof job.data?.revision === 'string' ? job.data.revision : undefined;
		console.log(`[transcode-worker] start ${trackId} (attempt ${job.attemptsMade + 1})`);
		await processTranscodeJob(trackId, revision);
	},
	TRANSCODE_QUEUE_NAME,
	transcodeConnection,
	TRANSCODE_WORKER_TIMEOUT_MS
);

const embedTagsWorker = startWorker(
	'embed-tags-worker',
	async (job) => {
		const trackId = job.data?.trackId;
		const userId = job.data?.userId;
		if (typeof trackId !== 'string' || !trackId) {
			throw new Error('Job missing trackId');
		}
		if (typeof userId !== 'string' || !userId) {
			throw new Error('Job missing userId');
		}
		const mode = parseTagEmbedMode(job.data?.mode);
		const revision = typeof job.data?.revision === 'string' ? job.data.revision : undefined;
		console.log(`[embed-tags-worker] start ${trackId} ${mode} (attempt ${job.attemptsMade + 1})`);
		await processEmbedTagsJob(trackId, userId, mode, revision);
	},
	EMBED_TAGS_QUEUE_NAME,
	embedTagsConnection,
	EMBED_TAGS_WORKER_TIMEOUT_MS
);

console.log(
	`[waveform-worker] listening on queues "${WAVEFORM_QUEUE_NAME}" + "${TRANSCODE_QUEUE_NAME}" + "${EMBED_TAGS_QUEUE_NAME}" (${redisUrl})`
);

async function shutdown(signal) {
	console.log(`[waveform-worker] ${signal}; closing…`);
	await Promise.all([waveformWorker.close(), transcodeWorker.close(), embedTagsWorker.close()]);
	waveformConnection.disconnect();
	transcodeConnection.disconnect();
	embedTagsConnection.disconnect();
	process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
