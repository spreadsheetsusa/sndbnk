import { browser } from '$app/env';

/** @typedef {'image' | 'video'} SiteMediaKind */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   kind: SiteMediaKind,
 *   mime: string,
 *   bytes: number,
 *   createdAt: number,
 *   url: string
 * }} SiteMediaItem
 */

/**
 * Site-design library for the builder. Reassign `items` — the list is raw state.
 */
class SiteMediaLibrary {
	/** @type {SiteMediaItem[]} */
	items = $state.raw([]);
	loading = $state(false);
	uploading = $state(false);
	/** @type {string | null} */
	error = $state(null);
	#loadedFor = '';
	#request = 0;

	/**
	 * @param {string} siteId
	 */
	async ensure(siteId) {
		if (!browser || !siteId) return;
		if (this.#loadedFor === siteId) return;
		await this.load(siteId);
	}

	/**
	 * @param {string} siteId
	 */
	async load(siteId) {
		if (!browser || !siteId) return;
		const request = ++this.#request;
		this.loading = true;
		this.error = null;
		try {
			const res = await fetch(`/api/sites/${siteId}/media`, {
				headers: { accept: 'application/json' }
			});
			if (request !== this.#request) return;
			if (!res.ok) {
				this.error = await readError(res);
				return;
			}
			const body = await res.json();
			this.items = Array.isArray(body.items) ? body.items : [];
			this.#loadedFor = siteId;
		} catch {
			if (request !== this.#request) return;
			this.error = 'Could not load the library.';
		} finally {
			if (request === this.#request) this.loading = false;
		}
	}

	/**
	 * @param {string} siteId
	 * @param {File} file
	 * @returns {Promise<SiteMediaItem | null>}
	 */
	async upload(siteId, file) {
		if (!browser || !siteId) return null;
		this.#request += 1;
		this.loading = false;
		this.uploading = true;
		this.error = null;
		try {
			const form = new FormData();
			form.set('file', file);
			const res = await fetch(`/api/sites/${siteId}/media`, {
				method: 'POST',
				body: form,
				headers: { accept: 'application/json' }
			});
			if (!res.ok) {
				this.error = await readError(res);
				return null;
			}
			const body = await res.json();
			const item = /** @type {SiteMediaItem} */ (body.item);
			this.items = [item, ...this.items.filter((row) => row.id !== item.id)];
			this.#loadedFor = siteId;
			return item;
		} catch {
			this.error = 'Could not upload that file.';
			return null;
		} finally {
			this.uploading = false;
		}
	}

	/**
	 * @param {string} siteId
	 * @param {string} assetId
	 * @param {string} name
	 */
	async rename(siteId, assetId, name) {
		if (!browser || !siteId) return;
		this.error = null;
		try {
			const res = await fetch(`/api/sites/${siteId}/media/${assetId}`, {
				method: 'PATCH',
				headers: { accept: 'application/json', 'content-type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (!res.ok) {
				this.error = await readError(res);
				return;
			}
			const body = await res.json();
			const item = /** @type {SiteMediaItem} */ (body.item);
			this.items = this.items.map((row) => (row.id === item.id ? item : row));
		} catch {
			this.error = 'Could not rename that file.';
		}
	}

	/**
	 * @param {string} siteId
	 * @param {string} assetId
	 */
	async remove(siteId, assetId) {
		if (!browser || !siteId) return false;
		this.error = null;
		try {
			const res = await fetch(`/api/sites/${siteId}/media/${assetId}`, {
				method: 'DELETE',
				headers: { accept: 'application/json' }
			});
			if (!res.ok) {
				this.error = await readError(res);
				return false;
			}
			this.items = this.items.filter((row) => row.id !== assetId);
			return true;
		} catch {
			this.error = 'Could not delete that file.';
			return false;
		}
	}
}

/**
 * @param {Response} res
 */
async function readError(res) {
	try {
		const body = await res.json();
		if (typeof body?.message === 'string' && body.message) return body.message;
	} catch {
		// Kit's error() is JSON `{ message }` when the client asks for JSON.
	}
	return 'Something went wrong.';
}

export const siteMediaLibrary = new SiteMediaLibrary();
