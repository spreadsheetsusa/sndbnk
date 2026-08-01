/**
 * Wire a `TrackList` to SvelteKit's snapshot API.
 *
 * What gets persisted is a cursor and a pixel offset — roughly a hundred bytes —
 * not the loaded tracks. Kit keeps snapshots in `sessionStorage` for the whole
 * session, so storing pages of waveform data here would be a memory leak with a
 * quota error at the end of it. The cursor is enough to refetch a window around
 * where the reader was, which is also why coming back to item 400 costs two
 * requests instead of seventeen.
 *
 * All the work happens in `restore`: Kit calls it after its own scroll handling
 * and after `afterNavigate`, so this is the last word on where the page sits.
 *
 * @param {() => import('#lib/lists/track-list.svelte.js').TrackList} getList
 */
export function listSnapshot(getList) {
	return {
		capture: () => getList().captureAnchor(),
		/** @param {import('#lib/lists/track-list.svelte.js').ListAnchor | null} anchor */
		restore: (anchor) => {
			if (anchor) getList().restoreAnchor(anchor);
		}
	};
}
