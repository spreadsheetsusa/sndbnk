import { untrack } from 'svelte';

import { listSnapshot } from '#lib/lists/list-snapshot.js';
import { TrackList } from '#lib/lists/track-list.svelte.js';

/**
 * A `TrackList` that survives everything except a change to what is being listed,
 * paired with the snapshot hooks that put the reader back where they were.
 *
 * `getQuery` is tracked: when what it reads changes — a different genre, a
 * different profile — the list starts over, which is the one case where the
 * pages held are the wrong answer. `getSeed` is read untracked, so a `load`
 * rerun for the *same* query cannot discard pages already scrolled through.
 *
 * @param {() => import('#lib/lists/track-list.svelte.js').ListQuery} getQuery
 * @param {() => { tracks: import('#lib/lists/track-list.svelte.js').ListTrack[], nextCursor: string | null }} getSeed
 * @param {() => HTMLElement | null | undefined} getContainer
 */
export function restorableList(getQuery, getSeed, getContainer) {
	const list = $derived.by(() => {
		const query = getQuery();
		return untrack(() => new TrackList(query, getSeed(), getContainer));
	});

	$effect(() => {
		const current = list;
		return () => current.destroy();
	});

	return {
		get current() {
			return list;
		},
		snapshot: listSnapshot(() => list)
	};
}
