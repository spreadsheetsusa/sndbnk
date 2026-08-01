import { tick } from 'svelte';

/**
 * A paged track listing that walks a keyset cursor in both directions.
 *
 * One instance per rendered list (not a singleton): the page seeds it from its
 * `load` data and owns it for the life of that list. Server pages are appended
 * or prepended; nothing is refetched that is already held.
 *
 * @typedef {{ id: string, cursor: string } & Record<string, any>} ListTrack
 *
 * `owner` is not sent anywhere — it exists so a list can be keyed on whose it is
 * when the scope alone does not say.
 *
 * @typedef {{
 *   scope: 'feed' | 'library' | 'profile',
 *   username?: string | null,
 *   genre?: string | null,
 *   following?: boolean,
 *   owner?: string | null
 * }} ListQuery
 *
 * @typedef {{ cursor: string, offset: number }} ListAnchor
 */

const LOAD_FAILED = 'Could not load more tracks.';

/**
 * How far the node sits below the top of the document, walked through the
 * layout tree. `getBoundingClientRect()` folds in the list's entrance
 * animation, which would bake one frame of a transform into a scroll position
 * that outlives it.
 *
 * @param {HTMLElement} node
 */
const documentTop = (node) => {
	let top = 0;
	for (let el = /** @type {HTMLElement | null} */ (node); el; el = el.offsetParent)
		top += el.offsetTop;
	return top;
};

export class TrackList {
	/** @type {ListTrack[]} */
	items = $state([]);
	/** Cursor for the next page of older items; null once the end is reached. */
	olderCursor = $state(/** @type {string | null} */ (null));
	/** Cursor for the next page of newer items; null while the newest is loaded. */
	newerCursor = $state(/** @type {string | null} */ (null));
	loadingOlder = $state(false);
	loadingNewer = $state(false);
	/** @type {string | null} */
	error = $state(null);
	/** Announced through an aria-live region after each page settles. */
	status = $state('');

	/** @type {Record<string, string>} */
	#params;
	/** @type {() => HTMLElement | null | undefined} */
	#getContainer;
	/** @type {Set<AbortController>} */
	#pending = new Set();
	/** Ids already held, so a track added mid-scroll cannot appear twice. */
	#seen = new Set();

	/**
	 * @param {ListQuery} query
	 * @param {{ tracks: ListTrack[], nextCursor: string | null }} seed first page, rendered on the server
	 * @param {() => HTMLElement | null | undefined} getContainer element wrapping the rendered rows
	 */
	constructor(query, seed, getContainer) {
		this.#params = { scope: query.scope };
		if (query.username) this.#params.username = query.username;
		if (query.genre) this.#params.genre = query.genre;
		if (query.following) this.#params.following = '1';
		this.#getContainer = getContainer;

		this.items = seed.tracks;
		this.olderCursor = seed.nextCursor;
		for (const item of seed.tracks) this.#seen.add(item.id);
	}

	get atEnd() {
		return this.olderCursor === null;
	}

	get atTop() {
		return this.newerCursor === null;
	}

	/**
	 * Sentinel entry point: a failed page must not be retried on every scroll tick.
	 * Resolves to whether the page grew, which is what lets the sentinel re-arm.
	 *
	 * @returns {Promise<boolean>}
	 */
	async autoLoadOlder() {
		return this.error ? false : this.loadOlder();
	}

	/** @returns {Promise<boolean>} */
	async autoLoadNewer() {
		return this.error ? false : this.loadNewer();
	}

	/** @returns {Promise<boolean>} whether any new tracks were appended */
	async loadOlder() {
		if (this.loadingOlder || !this.olderCursor) return false;
		this.loadingOlder = true;
		this.error = null;

		try {
			const page = await this.#fetchPage({ cursor: this.olderCursor, direction: 'older' });
			const fresh = this.#take(page.tracks);
			this.items = [...this.items, ...fresh];
			this.olderCursor = page.nextCursor ?? null;
			this.status = this.olderCursor ? `Loaded ${fresh.length} more tracks.` : 'End of list.';
			return fresh.length > 0;
		} catch (err) {
			this.#fail(err);
			return false;
		} finally {
			this.loadingOlder = false;
		}
	}

	/** @returns {Promise<boolean>} whether any new tracks were prepended */
	async loadNewer() {
		if (this.loadingNewer || !this.newerCursor) return false;
		this.loadingNewer = true;
		this.error = null;

		try {
			const page = await this.#fetchPage({ cursor: this.newerCursor, direction: 'newer' });
			const fresh = this.#take(page.tracks);
			// Prepending grows the document above the viewport, which would shove the
			// reader down the page. Pinning the row they are looking at corrects that
			// to an absolute position, so it stays right whether or not the browser's
			// own scroll anchoring got there first — adding back a measured delta
			// would double up with it.
			const anchor = this.captureAnchor();
			this.items = [...fresh, ...this.items];
			this.newerCursor = page.nextCursor ?? null;
			await tick();
			if (anchor) this.#alignTo(anchor);
			this.status = `Loaded ${fresh.length} earlier tracks.`;
			return fresh.length > 0;
		} catch (err) {
			this.#fail(err);
			return false;
		} finally {
			this.loadingNewer = false;
		}
	}

	/**
	 * Replace the list with a window centred on `cursor` — one page above it and
	 * one starting at it. Returning to item 400 costs two requests, not seventeen.
	 *
	 * @param {string} cursor
	 */
	async restoreAround(cursor) {
		this.loadingOlder = true;
		this.loadingNewer = true;
		this.error = null;

		try {
			const [newer, older] = await Promise.all([
				this.#fetchPage({ cursor, direction: 'newer' }),
				this.#fetchPage({ cursor, direction: 'older', inclusive: true })
			]);

			if (older.tracks.length === 0 && newer.tracks.length === 0) return false;

			this.#seen.clear();
			this.items = this.#take([...newer.tracks, ...older.tracks]);
			this.newerCursor = newer.nextCursor ?? null;
			this.olderCursor = older.nextCursor ?? null;
			return true;
		} catch (err) {
			this.#fail(err);
			return false;
		} finally {
			this.loadingOlder = false;
			this.loadingNewer = false;
		}
	}

	/**
	 * The topmost card still touching the viewport, plus how far above the fold it
	 * sits — enough to put the reader back on the same row later.
	 *
	 * @returns {ListAnchor | null}
	 */
	captureAnchor() {
		const container = this.#getContainer();
		if (!container) return null;

		for (const node of container.querySelectorAll('[data-cursor]')) {
			const el = /** @type {HTMLElement} */ (node);
			const offset = documentTop(el) - window.scrollY;
			if (offset + el.offsetHeight > 0 && el.dataset.cursor) {
				return { cursor: el.dataset.cursor, offset };
			}
		}

		return null;
	}

	/**
	 * @param {ListAnchor} anchor
	 */
	async restoreAnchor(anchor) {
		if (!(await this.restoreAround(anchor.cursor))) return;
		await tick();

		// Rows below the fold are laid out from their estimated size until they are
		// scrolled near, so the first alignment lands close and the second lands it.
		this.#alignTo(anchor);
		await new Promise(requestAnimationFrame);
		this.#alignTo(anchor);
	}

	/**
	 * Drop a track the viewer deleted, without discarding everything else loaded.
	 * @param {string} id
	 */
	remove(id) {
		this.items = this.items.filter((item) => item.id !== id);
		this.#seen.delete(id);
	}

	/** Abandon in-flight pages so a slow response cannot append into a dead list. */
	destroy() {
		for (const controller of this.#pending) controller.abort();
		this.#pending.clear();
	}

	/**
	 * @param {ListAnchor} anchor
	 */
	#alignTo(anchor) {
		const container = this.#getContainer();
		// The anchor track may have been deleted since; the next row down is the
		// closest thing to where the reader was.
		const node = /** @type {HTMLElement | null} */ (
			container?.querySelector(`[data-cursor="${CSS.escape(anchor.cursor)}"]`) ??
				container?.querySelector('[data-cursor]')
		);
		if (!node) return;

		const top = documentTop(node) - anchor.offset;
		// Explicitly instant: the app sets `scroll-behavior: smooth` globally, and
		// animating a jump the reader never asked for reads as a lurch.
		if (Math.abs(top - window.scrollY) > 1) window.scrollTo({ top, behavior: 'instant' });
	}

	/**
	 * @param {{ cursor: string, direction: 'older' | 'newer', inclusive?: boolean }} input
	 * @returns {Promise<{ tracks: ListTrack[], nextCursor: string | null }>}
	 */
	async #fetchPage({ cursor, direction, inclusive = false }) {
		const params = new URLSearchParams({ ...this.#params, cursor, direction });
		if (inclusive) params.set('inclusive', '1');

		const controller = new AbortController();
		this.#pending.add(controller);

		try {
			const res = await fetch(`/api/tracks?${params}`, { signal: controller.signal });
			if (!res.ok) throw new Error(LOAD_FAILED);
			return await res.json();
		} finally {
			this.#pending.delete(controller);
		}
	}

	/**
	 * @param {ListTrack[]} tracks
	 */
	#take(tracks) {
		const fresh = tracks.filter((item) => !this.#seen.has(item.id));
		for (const item of fresh) this.#seen.add(item.id);
		return fresh;
	}

	/**
	 * @param {unknown} err
	 */
	#fail(err) {
		// An aborted page was replaced or the list went away; not something to report.
		if (err instanceof DOMException && err.name === 'AbortError') return;
		this.error = err instanceof Error ? err.message : LOAD_FAILED;
	}
}
