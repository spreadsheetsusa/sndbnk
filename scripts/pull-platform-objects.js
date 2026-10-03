/**
 * Download platform objects from S3 into a staging directory.
 * Run on the production host (instance role / server `.env`), not a laptop:
 *
 *   cd /var/www/sndbnk && bun - /tmp/manifest.jsonl /tmp/out < pull-platform-objects.js
 *
 * `pull-prod.sh` pipes this script over SSH. It must not import `#lib` or `$app`.
 * Missing optional objects (waveforms, unused derivatives) are skips.
 * A missing required object fails the run after the rest are attempted.
 */
import { once } from 'node:events';
import { mkdir, rename, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

const manifestPath = process.argv[2];
const outRoot = process.argv[3];
if (!manifestPath || !outRoot) {
	die('usage: pull-platform-objects.js MANIFEST.jsonl OUT_DIR');
}

const config = await loadS3Config();
const client = new S3Client({
	region: config.region,
	...(config.endpoint ? { endpoint: config.endpoint } : {}),
	...(config.forcePathStyle ? { forcePathStyle: true } : {}),
	...(config.accessKeyId && config.secretAccessKey
		? {
				credentials: {
					accessKeyId: config.accessKeyId,
					secretAccessKey: config.secretAccessKey,
					...(config.sessionToken ? { sessionToken: config.sessionToken } : {})
				}
			}
		: {})
});

const text = await Bun.file(manifestPath).text();
let ok = 0;
let skipped = 0;
let failed = 0;

for (const line of text.split('\n')) {
	const trimmed = line.trim();
	if (!trimmed) continue;
	/** @type {PlatformObject} */
	let object;
	try {
		object = JSON.parse(trimmed);
	} catch {
		failed += 1;
		console.error(`fail: invalid manifest line`);
		continue;
	}

	const label = `${object.kind} ${object.userId}/${object.folderKey}/${object.filename}`;
	try {
		const dest = objectPath(outRoot, object.userId, object.folderKey, object.filename);
		const size = await downloadObject(object, dest);
		ok += 1;
		console.error(`ok ${label} ${size}`);
	} catch (err) {
		if (isAuthFailure(err)) {
			die(err instanceof Error ? err.message : 'S3 access denied');
		}
		if (!object.required && isMissing(err)) {
			skipped += 1;
			console.error(`skip ${label}`);
			continue;
		}
		failed += 1;
		const reason = err instanceof Error ? err.message : 'download failed';
		console.error(`fail ${label}: ${reason}`);
	}
}

console.error(`platform fetch done ok=${ok} skipped=${skipped} failed=${failed}`);
if (failed > 0) process.exit(1);

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
 * @param {PlatformObject} object
 * @param {string} dest
 */
async function downloadObject(object, dest) {
	let lastError = /** @type {unknown} */ (null);
	for (let attempt = 1; attempt <= 2; attempt += 1) {
		try {
			return await downloadObjectOnce(object, dest);
		} catch (err) {
			lastError = err;
			if (isMissing(err) || isAuthFailure(err) || attempt === 2) throw err;
			const reason = err instanceof Error ? err.message : 'download failed';
			console.error(`retry ${object.userId}/${object.folderKey}/${object.filename}: ${reason}`);
		}
	}
	throw lastError instanceof Error ? lastError : new Error('download failed');
}

/**
 * @param {PlatformObject} object
 * @param {string} dest
 */
async function downloadObjectOnce(object, dest) {
	const key = `${object.userId}/${object.folderKey}/${object.filename}`;
	let response;
	try {
		response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
	} catch (err) {
		if (isMissing(err)) throw new Error('File not found.');
		throw err;
	}
	if (!response.Body) throw new Error('File not found.');

	const partial = `${dest}.partial`;
	await mkdir(path.dirname(dest), { recursive: true });
	await writeBody(response.Body, partial);
	const info = await stat(partial);
	if (response.ContentLength != null && info.size !== response.ContentLength) {
		await Bun.file(partial).delete();
		throw new Error(`size ${info.size} != ContentLength ${response.ContentLength}`);
	}
	if (object.bytes > 0 && info.size !== object.bytes) {
		console.error(
			`warn ${object.userId}/${object.folderKey}/${object.filename}: size ${info.size} != database ${object.bytes}`
		);
	}
	await rename(partial, dest);
	return info.size;
}

/**
 * @param {unknown} body
 * @param {string} dest
 */
async function writeBody(body, dest) {
	// Async iteration. `Readable.fromWeb` dropped the last 512KB chunk on Bun.
	if (body != null && typeof body[Symbol.asyncIterator] === 'function') {
		const out = createWriteStream(dest);
		try {
			for await (const chunk of body) {
				if (!out.write(chunk)) await once(out, 'drain');
			}
		} catch (err) {
			out.destroy();
			throw err;
		}
		await new Promise((resolve, reject) => {
			out.on('error', reject);
			out.end(resolve);
		});
		return;
	}
	const streamBody =
		/** @type {{ transformToWebStream?: () => ReadableStream, pipe?: Function }} */ (body);
	if (typeof streamBody.transformToWebStream === 'function') {
		await pipeline(Readable.fromWeb(streamBody.transformToWebStream()), createWriteStream(dest));
		return;
	}
	if (typeof streamBody.pipe === 'function') {
		await pipeline(/** @type {import('node:stream').Readable} */ (body), createWriteStream(dest));
		return;
	}
	const bytes =
		body &&
		typeof (
			/** @type {{ transformToByteArray?: () => Promise<Uint8Array> }} */ (body)
				.transformToByteArray
		) === 'function'
			? await /** @type {{ transformToByteArray: () => Promise<Uint8Array> }} */ (
					body
				).transformToByteArray()
			: body;
	await Bun.write(dest, /** @type {Bun.BlobPart} */ (bytes));
}

/**
 * @param {string} root
 * @param {string} userId
 * @param {string} folderKey
 * @param {string} filename
 */
function objectPath(root, userId, folderKey, filename) {
	for (const [part, label] of [
		[userId, 'user id'],
		[folderKey, 'folder key'],
		[filename, 'filename']
	]) {
		if (!part || part === '.' || part === '..' || !SAFE_SEGMENT.test(part)) {
			throw new Error(`Invalid ${label}.`);
		}
	}
	const resolvedRoot = path.resolve(root);
	const resolved = path.resolve(root, userId, folderKey, filename);
	if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
		throw new Error('Invalid storage path.');
	}
	return resolved;
}

/**
 * @param {unknown} err
 */
/**
 * @param {unknown} err
 */
function isAuthFailure(err) {
	if (!(err instanceof Error)) return false;
	if (
		err.name === 'AccessDenied' ||
		err.name === 'CredentialsProviderError' ||
		err.name === 'ExpiredToken' ||
		err.name === 'InvalidAccessKeyId'
	) {
		return true;
	}
	const status = /** @type {{ $metadata?: { httpStatusCode?: number } }} */ (err).$metadata
		?.httpStatusCode;
	return status === 401 || status === 403;
}

/**
 * @param {unknown} err
 */
function isMissing(err) {
	if (!(err instanceof Error)) return false;
	if (err.message === 'File not found.') return true;
	if (err.name === 'NoSuchKey' || err.name === 'NotFound') return true;
	const status = /** @type {{ $metadata?: { httpStatusCode?: number } }} */ (err).$metadata
		?.httpStatusCode;
	return status === 404;
}

async function loadS3Config() {
	const bucket = await envValue('S3_BUCKET');
	if (!bucket) die('remote S3_BUCKET is empty; platform objects cannot be fetched');

	const accessKeyId = await envValue('S3_ACCESS_KEY_ID');
	const secretAccessKey = await envValue('S3_SECRET_ACCESS_KEY');
	if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
		die('remote S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must both be set, or both empty');
	}

	return {
		bucket,
		region: (await envValue('S3_REGION')) || 'us-east-1',
		accessKeyId,
		secretAccessKey,
		sessionToken: await envValue('S3_SESSION_TOKEN'),
		endpoint: await envValue('S3_ENDPOINT'),
		forcePathStyle: (await envValue('S3_FORCE_PATH_STYLE')) === 'true'
	};
}

/**
 * Last assignment in the host `.env` wins, matching the shell pull script.
 * @param {string} name
 */
async function envValue(name) {
	const fromProcess = process.env[name]?.trim();
	let text = '';
	try {
		text = await Bun.file('.env').text();
	} catch {
		return fromProcess || '';
	}
	let value = '';
	for (const line of text.split('\n')) {
		if (!line.startsWith(`${name}=`)) continue;
		value = stripQuotes(line.slice(name.length + 1).trim());
	}
	return value || fromProcess || '';
}

/**
 * @param {string} value
 */
function stripQuotes(value) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}
	return value;
}

/**
 * @param {string} message
 */
function die(message) {
	console.error(`error: ${message}`);
	process.exit(1);
}
