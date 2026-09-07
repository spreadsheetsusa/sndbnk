import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Normalize a storage body onto disk for ffmpeg (needs a seekable path).
 *
 * @param {import('./types.js').StorageObject['body']} body
 * @param {string} destPath
 */
export async function writeStorageBodyToFile(body, destPath) {
	await mkdir(path.dirname(destPath), { recursive: true });

	if (body instanceof Uint8Array) {
		await writeFile(destPath, body);
		return;
	}
	if (typeof Blob !== 'undefined' && body instanceof Blob) {
		await writeFile(destPath, new Uint8Array(await body.arrayBuffer()));
		return;
	}

	const bytes = new Uint8Array(await new Response(/** @type {BodyInit} */ (body)).arrayBuffer());
	await writeFile(destPath, bytes);
}

/**
 * Fetch an object through any adapter and stage it to `destPath`.
 *
 * @param {import('./types.js').StorageAdapter} adapter
 * @param {string} folderKey
 * @param {string} filename
 * @param {string} destPath
 */
export async function stageAdapterObjectToFile(adapter, folderKey, filename, destPath) {
	const object = await adapter.get(folderKey, filename);
	await writeStorageBodyToFile(object.body, destPath);
}
