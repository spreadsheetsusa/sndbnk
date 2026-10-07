<script>
	import {
		STREAM_ARTIST_SEP,
		streamQueryKey,
		streamSearchParams
	} from '#lib/builder/stream-query.js';
	import StreamItems from '#lib/components/blocks/StreamItems.svelte';
	import InfiniteList from '#lib/components/lists/InfiniteList.svelte';
	import { restorableList } from '#lib/lists/restorable-list.svelte.js';

	/**
	 * @type {{
	 *   username: string,
	 *   query: import('#lib/builder/stream-query.js').StreamQuery,
	 *   seed?: { key?: string, items: import('#lib/lists/track-list.svelte.js').ListItem[], nextCursor: string | null } | null,
	 *   profileData: Record<string, any>,
	 *   narrow?: ((item: Record<string, any>) => boolean) | null,
	 *   pending?: boolean,
	 *   placeholder?: Array<Record<string, any>> | null,
	 *   emptyLabel?: string
	 * }}
	 */
	let {
		username,
		query,
		seed = null,
		profileData,
		narrow = null,
		pending = false,
		placeholder = null,
		emptyLabel = 'No tracks match this stream.'
	} = $props();

	/** @type {HTMLElement | undefined} */
	let box = $state.raw();
	/** @type {{ key: string, items: import('#lib/lists/track-list.svelte.js').ListItem[], nextCursor: string | null } | null} */
	let fetched = $state(null);
	let failed = $state(/** @type {string | null} */ (null));
	let loading = $state(false);

	const requestKey = $derived(streamQueryKey(query));
	const fresh = $derived(seed ?? (fetched?.key === requestKey ? fetched : null));
	const source = $derived(
		fresh ?? fetched ?? (placeholder ? { items: placeholder, nextCursor: null } : null)
	);

	const paged = restorableList(
		() => ({
			scope: 'stream',
			username,
			genre: query.genre,
			mediaType: query.mediaType,
			dateFrom: query.dateFrom,
			dateTo: query.dateTo,
			artists: query.artists.length ? query.artists.join(STREAM_ARTIST_SEP) : null,
			count: query.count,
			q: query.q,
			owner: fresh ? `ready:${fresh.items.length}:${fresh.nextCursor ?? ''}` : 'pending'
		}),
		() => fresh ?? { items: [], nextCursor: null },
		() => box
	);

	const shown = $derived.by(() => {
		const items = fresh && paged.current ? paged.current.items : (source?.items ?? []);
		return narrow ? items.filter((item) => narrow(item)) : items;
	});

	/** @type {import('svelte/attachments').Attachment} */
	const captureBox = (node) => {
		box = node;
		return () => {
			if (box === node) box = undefined;
		};
	};

	$effect(() => {
		if (seed) return;
		const key = requestKey;
		const params = new URLSearchParams({
			scope: 'stream',
			username,
			...streamSearchParams(query)
		});
		const controller = new AbortController();
		let alive = true;
		loading = true;
		failed = null;
		fetch(`/api/tracks?${params}`, { signal: controller.signal })
			.then(async (res) => {
				if (!res.ok) throw new Error('Could not load this stream.');
				return res.json();
			})
			.then((body) => {
				if (!alive) return;
				fetched = { key, items: body.items ?? [], nextCursor: body.nextCursor ?? null };
			})
			.catch((err) => {
				if (!alive) return;
				if (err instanceof DOMException && err.name === 'AbortError') return;
				failed = 'Could not load this stream.';
			})
			.finally(() => {
				if (alive) loading = false;
			});
		return () => {
			alive = false;
			controller.abort();
		};
	});
</script>

<div class="results" {@attach captureBox} aria-busy={loading || pending}>
	{#if shown.length === 0}
		<p class="empty" role="status">
			{#if failed && !source}
				{failed}
			{:else if loading || pending}
				Searching…
			{:else}
				{emptyLabel}
			{/if}
		</p>
	{:else if fresh && paged.current}
		<InfiniteList list={paged.current} moreLabel="Load more">
			<StreamItems items={shown} {profileData} onremove={(id) => paged.current.remove(id)} />
		</InfiniteList>
	{:else}
		<StreamItems items={shown} {profileData} />
	{/if}
</div>

<style>
	.empty {
		margin: 0;
		color: var(--muted);
	}
</style>
