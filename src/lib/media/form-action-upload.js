import { deserialize } from '$app/forms';

/**
 * Browser→SNDBNK transfer snapshot from an XHR `upload.onprogress` event.
 *
 * @typedef {{
 *   loaded: number,
 *   total: number,
 *   lengthComputable: boolean,
 *   percent: number | null,
 *   bytesPerSec: number | null
 * }} UploadProgress
 */

/**
 * POST FormData to a SvelteKit named form action and report upload progress.
 * Native `fetch` does not expose `upload.onprogress`.
 *
 * This is the browser→app transfer only, which covers default hosted storage
 * (local `MEDIA_ROOT` and platform S3) because the file hits the app first.
 * TODO: creator BYOS (SSH / user-owned S3/R2) server-side transfer progress.
 *
 * @param {string} action
 * @param {FormData} body
 * @param {(progress: UploadProgress) => void} [onProgress]
 * @returns {Promise<import('@sveltejs/kit').ActionResult>}
 */
export function postFormAction(action, body, onProgress) {
	const startedAt = Date.now();

	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', action);
		// Match `enhance`: JSON action result so `deserialize()` can parse it.
		xhr.setRequestHeader('Accept', 'application/json');
		xhr.setRequestHeader('x-sveltekit-action', 'true');

		xhr.onload = () => {
			try {
				if (xhr.status === 204) {
					resolve({ type: 'success', status: 204 });
					return;
				}
				const result = deserialize(xhr.responseText);
				if (result.type === 'error' || result.type === 'failure') {
					result.status = xhr.status;
				}
				resolve(result);
			} catch (error) {
				reject(error);
			}
		};
		xhr.onerror = () => reject(new TypeError('Failed to fetch'));
		xhr.onabort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));

		if (onProgress) {
			xhr.upload.onprogress = (event) => {
				onProgress(snapshotUploadProgress(event, startedAt));
			};
		}

		xhr.send(body);
	});
}

/**
 * @param {ProgressEvent} event
 * @param {number} startedAt
 * @returns {UploadProgress}
 */
export function snapshotUploadProgress(event, startedAt) {
	const loaded = event.loaded;
	const total = event.total;
	const lengthComputable = Boolean(event.lengthComputable && total > 0);
	const percent = lengthComputable ? Math.min(100, Math.round((loaded / total) * 100)) : null;
	const elapsedSec = (Date.now() - startedAt) / 1000;
	const bytesPerSec = elapsedSec > 0.2 && loaded > 0 ? loaded / elapsedSec : null;
	return { loaded, total, lengthComputable, percent, bytesPerSec };
}
