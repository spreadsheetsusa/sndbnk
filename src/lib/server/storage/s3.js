import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import {
	DeleteObjectCommand,
	DeleteObjectsCommand,
	GetObjectCommand,
	HeadBucketCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';

import { isMissingStorageObject } from './errors.js';
import { assertSafeStorageSegment } from './path-safety.js';
import { getPlatformS3Config } from './s3-config.js';

/**
 * @typedef {import('./s3-config.js').PlatformS3Config} S3AdapterConfig
 */

/** @type {WeakMap<S3AdapterConfig, S3Client>} */
const clients = new WeakMap();

/** @type {S3Client | null} */
let defaultClient = null;
/** @type {string} */
let defaultClientKey = '';

/**
 * Inclusive range → S3 `Range` header. Omit `end` for through-EOF (`bytes=N-`).
 *
 * @param {import('./types.js').StorageByteRange} range
 */
export function s3RangeHeader(range) {
	const start = Math.max(0, range.start);
	if (range.end == null) return `bytes=${start}-`;
	return `bytes=${start}-${range.end}`;
}

/**
 * Parse `Content-Range: bytes start-end/total` for the full object length.
 *
 * @param {string | undefined} header
 * @returns {number | null}
 */
export function parseS3ContentRangeTotal(header) {
	if (!header) return null;
	const match = /^bytes\s+\d+-\d+\/(\d+)$/i.exec(header.trim());
	if (!match) return null;
	const total = Number.parseInt(match[1], 10);
	return Number.isFinite(total) ? total : null;
}

/**
 * @param {string} userId
 * @param {string} folderKey
 * @param {string} [filename]
 */
export function s3ObjectKey(userId, folderKey, filename) {
	assertSafeStorageSegment(userId, 'user id');
	assertSafeStorageSegment(folderKey, 'folder key');
	const prefix = `${userId}/${folderKey}`;
	if (!filename) return `${prefix}/`;
	assertSafeStorageSegment(filename, 'filename');
	return `${prefix}/${filename}`;
}

/**
 * @param {S3AdapterConfig} [config]
 */
export function getS3Client(config) {
	const resolved = config ?? getPlatformS3Config();
	if (!resolved) {
		throw new Error('Platform S3 storage is not configured.');
	}

	if (config) {
		const existing = clients.get(config);
		if (existing) return existing;
		const created = buildS3Client(resolved);
		clients.set(config, created);
		return created;
	}

	const key = `${resolved.bucket}\0${resolved.region}\0${resolved.endpoint ?? ''}\0${resolved.accessKeyId ?? ''}`;
	if (defaultClient && defaultClientKey === key) return defaultClient;
	defaultClient = buildS3Client(resolved);
	defaultClientKey = key;
	return defaultClient;
}

/**
 * @param {S3AdapterConfig} config
 */
function buildS3Client(config) {
	/** @type {import('@aws-sdk/client-s3').S3ClientConfig} */
	const init = {
		region: config.region
	};

	if (config.endpoint) {
		init.endpoint = config.endpoint;
	}
	if (config.forcePathStyle) {
		init.forcePathStyle = true;
	}
	if (config.accessKeyId && config.secretAccessKey) {
		init.credentials = {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
			...(config.sessionToken ? { sessionToken: config.sessionToken } : {})
		};
	}

	return new S3Client(init);
}

/**
 * @param {unknown} err
 */
function translateS3Error(err) {
	if (isMissingStorageObject(err)) {
		return new Error('File not found.');
	}
	return err instanceof Error ? err : new Error('S3 request failed.');
}

/**
 * @param {import('@aws-sdk/client-s3').GetObjectCommandOutput['Body']} body
 * @returns {Uint8Array | ReadableStream | Blob}
 */
function s3Body(body) {
	if (!body) {
		throw new Error('File not found.');
	}
	if (typeof body.transformToWebStream === 'function') {
		return body.transformToWebStream();
	}
	if (body instanceof Uint8Array) return body;
	if (typeof Blob !== 'undefined' && body instanceof Blob) return body;
	return /** @type {ReadableStream} */ (body);
}

/**
 * @param {S3Client} client
 * @param {string} bucket
 * @param {string} prefix
 */
async function listKeys(client, bucket, prefix) {
	/** @type {string[]} */
	const keys = [];
	/** @type {string | undefined} */
	let token;
	do {
		const page = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken: token
			})
		);
		for (const object of page.Contents ?? []) {
			if (object.Key) keys.push(object.Key);
		}
		token = page.IsTruncated ? page.NextContinuationToken : undefined;
	} while (token);
	return keys;
}

/**
 * @param {S3Client} client
 * @param {string} bucket
 * @param {string[]} keys
 */
async function deleteKeys(client, bucket, keys) {
	for (let i = 0; i < keys.length; i += 1000) {
		const chunk = keys.slice(i, i + 1000);
		if (chunk.length === 0) continue;
		await client.send(
			new DeleteObjectsCommand({
				Bucket: bucket,
				Delete: {
					Objects: chunk.map((Key) => ({ Key })),
					Quiet: true
				}
			})
		);
	}
}

/**
 * MD5 hex of a file, streamed so 500MB uploads do not sit in RAM twice.
 * @param {string} filePath
 */
export async function md5FileHex(filePath) {
	const hasher = createHash('md5');
	const stream = createReadStream(filePath);
	for await (const chunk of stream) {
		hasher.update(chunk);
	}
	return hasher.digest('hex');
}

/**
 * Stream a local file to S3 (migration path). Verifies ContentMD5 on put.
 *
 * @param {string} key
 * @param {string} filePath
 * @param {string} [contentType]
 * @param {S3AdapterConfig} [config]
 * @returns {Promise<{ size: number, md5: string }>}
 */
export async function putS3ObjectFromFile(key, filePath, contentType, config) {
	const resolved = config ?? getPlatformS3Config();
	if (!resolved) {
		throw new Error('Platform S3 storage is not configured.');
	}

	const info = await stat(filePath);
	const md5 = await md5FileHex(filePath);
	const md5b64 = Buffer.from(md5, 'hex').toString('base64');

	try {
		await getS3Client(config).send(
			new PutObjectCommand({
				Bucket: resolved.bucket,
				Key: key,
				Body: createReadStream(filePath),
				ContentType: contentType || 'application/octet-stream',
				ContentLength: info.size,
				ContentMD5: md5b64
			})
		);
	} catch (err) {
		throw translateS3Error(err);
	}

	return { size: info.size, md5 };
}

/**
 * Head an object; `null` when missing.
 *
 * @param {string} key
 * @param {S3AdapterConfig} [config]
 * @returns {Promise<{ size: number, etag: string | null, contentType: string } | null>}
 */
export async function headS3Object(key, config) {
	const resolved = config ?? getPlatformS3Config();
	if (!resolved) {
		throw new Error('Platform S3 storage is not configured.');
	}
	try {
		const response = await getS3Client(config).send(
			new HeadObjectCommand({ Bucket: resolved.bucket, Key: key })
		);
		return {
			size: response.ContentLength ?? 0,
			etag: response.ETag?.replaceAll('"', '') ?? null,
			contentType: response.ContentType || 'application/octet-stream'
		};
	} catch (err) {
		if (isMissingStorageObject(err)) return null;
		throw translateS3Error(err);
	}
}

/**
 * Wipe every object under `{userId}/` (tracks, avatar, site assets).
 * @param {string} userId
 * @param {S3AdapterConfig} [config]
 */
export async function wipeUserS3Media(userId, config) {
	assertSafeStorageSegment(userId, 'user id');
	const resolved = config ?? getPlatformS3Config();
	if (!resolved) return;

	const client = getS3Client(config);
	const keys = await listKeys(client, resolved.bucket, `${userId}/`);
	await deleteKeys(client, resolved.bucket, keys);
}

/**
 * @param {string} userId
 * @param {S3AdapterConfig} [config]
 * @returns {import('./types.js').StorageAdapter}
 */
export function createS3Adapter(userId, config) {
	assertSafeStorageSegment(userId, 'user id');
	const resolved = config ?? getPlatformS3Config();
	if (!resolved) {
		throw new Error('Platform S3 storage is not configured.');
	}

	const client = getS3Client(config);
	const bucket = resolved.bucket;

	return {
		id: 's3',

		async put(folderKey, filename, data, contentType) {
			const key = s3ObjectKey(userId, folderKey, filename);
			const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
			const md5 = createHash('md5').update(bytes).digest('base64');
			try {
				await client.send(
					new PutObjectCommand({
						Bucket: bucket,
						Key: key,
						Body: bytes,
						ContentType: contentType || 'application/octet-stream',
						ContentLength: bytes.byteLength,
						ContentMD5: md5
					})
				);
			} catch (err) {
				throw translateS3Error(err);
			}
		},

		async get(folderKey, filename, range) {
			const key = s3ObjectKey(userId, folderKey, filename);
			/** @type {import('@aws-sdk/client-s3').GetObjectCommandInput} */
			const input = { Bucket: bucket, Key: key };
			if (range) {
				input.Range = s3RangeHeader(range);
			}

			try {
				const response = await client.send(new GetObjectCommand(input));
				const size =
					parseS3ContentRangeTotal(response.ContentRange) ??
					(range ? (await headS3Object(key, config))?.size : null) ??
					response.ContentLength ??
					0;
				return {
					body: s3Body(response.Body),
					contentType: response.ContentType || 'application/octet-stream',
					size
				};
			} catch (err) {
				throw translateS3Error(err);
			}
		},

		async delete(folderKey) {
			const prefix = s3ObjectKey(userId, folderKey);
			try {
				const keys = await listKeys(client, bucket, prefix);
				await deleteKeys(client, bucket, keys);
			} catch (err) {
				throw translateS3Error(err);
			}
		},

		async deleteObject(folderKey, filename) {
			const key = s3ObjectKey(userId, folderKey, filename);
			try {
				await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
			} catch (err) {
				if (isMissingStorageObject(err)) return;
				throw translateS3Error(err);
			}
		},

		async testConnection() {
			try {
				await client.send(new HeadBucketCommand({ Bucket: bucket }));
				await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
				return { ok: true };
			} catch (err) {
				return {
					ok: false,
					message: err instanceof Error ? err.message : 'Could not reach the S3 bucket.'
				};
			}
		}
	};
}
