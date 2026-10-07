<script>
	import { onDestroy } from 'svelte';

	import {
		streamBrowseActive,
		streamFacetKey,
		streamItemMatches,
		streamQueryActive,
		streamQueryKey,
		streamSearchParams,
		withStreamBrowse
	} from '#lib/builder/stream-query.js';
	import StreamItems from '#lib/components/blocks/StreamItems.svelte';
	import StreamSearch from '#lib/components/blocks/StreamSearch.svelte';
	import StreamSidebar from '#lib/components/blocks/StreamSidebar.svelte';
	import StreamTrackList from '#lib/components/blocks/StreamTrackList.svelte';
	import InfiniteList from '#lib/components/lists/InfiniteList.svelte';

	/**
	 * @type {{
	 *   username: string,
	 *   query: import('#lib/builder/stream-query.js').StreamQuery,
	 *   showSearch: boolean,
	 *   showSidebar: boolean,
	 *   profileData: Record<string, any>,
	 *   profileList?: import('#lib/lists/track-list.svelte.js').TrackList | null,
	 *   streamSeed?: { key: string, items: import('#lib/lists/track-list.svelte.js').ListItem[], nextCursor: string | null } | null,
	 *   streamFacets?: import('#lib/builder/stream-query.js').StreamFacets | null,
	 *   resultsId: string
	 * }}
	 */
	let {
		username,
		query,
		showSearch,
		showSidebar,
		profileData,
		profileList = null,
		streamSeed = null,
		streamFacets = null,
		resultsId
	} = $props();

	let q = $state('');
	let appliedQ = $state('');
	let pickedArtist = $state(/** @type {string | null} */ (null));
	let pickedGenre = $state(/** @type {string | null} */ (null));
	let timer = 0;
	/** @type {import('#lib/builder/stream-query.js').StreamFacets | null} */
	let loadedFacets = $state(null);

	onDestroy(() => clearTimeout(timer));

	const facetKey = $derived(streamFacetKey(query));
	const facets = $derived(
		streamFacets?.key === facetKey
			? streamFacets
			: loadedFacets?.key === facetKey
				? loadedFacets
				: null
	);
	const browse = $derived(
		withStreamBrowse(query, { q: appliedQ, artist: pickedArtist, genre: pickedGenre })
	);
	const browsing = $derived(
		streamBrowseActive({ q: appliedQ, artist: pickedArtist, genre: pickedGenre })
	);
	const active = $derived(streamQueryActive(query));
	const queryKey = $derived(streamQueryKey(query));
	const pending = $derived(q.trim() !== appliedQ);
	const narrow = $derived.by(() => {
		const text = q;
		const artist = pickedArtist;
		const genre = pickedGenre;
		if (!text.trim() && !artist && !genre) return null;
		return (/** @type {Record<string, any>} */ item) =>
			streamItemMatches(item, { q: text, artist, genre });
	});
	const placeholder = $derived.by(() => {
		if (!browsing && !pending) return null;
		const base =
			active && streamSeed?.key === queryKey ? streamSeed.items : (profileList?.items ?? []);
		return base.filter((item) =>
			streamItemMatches(item, { q, artist: pickedArtist, genre: pickedGenre })
		);
	});

	/**
	 * @param {string} value
	 */
	function setQuery(value) {
		q = value;
		clearTimeout(timer);
		timer = setTimeout(() => {
			appliedQ = q.trim();
		}, 140);
	}

	function clearQuery() {
		clearTimeout(timer);
		q = '';
		appliedQ = '';
	}

	$effect(() => {
		if (!showSidebar || !username) return;
		const key = facetKey;
		if (streamFacets?.key === key) return;
		const controller = new AbortController();
		let alive = true;
		const params = new URLSearchParams({
			scope: 'stream',
			username,
			facets: '1',
			...streamSearchParams({ ...query, count: null, q: null })
		});
		fetch(`/api/tracks?${params}`, { signal: controller.signal })
			.then(async (res) => {
				if (!res.ok) throw new Error('Could not load stream facets.');
				return res.json();
			})
			.then((body) => {
				if (!alive) return;
				loadedFacets = {
					key,
					artists: body.artists ?? [],
					genres: body.genres ?? [],
					mostLiked: body.mostLiked ?? []
				};
			})
			.catch((err) => {
				if (!alive) return;
				if (err instanceof DOMException && err.name === 'AbortError') return;
			});
		return () => {
			alive = false;
			controller.abort();
		};
	});
</script>

<div class="browse" class:has-sidebar={showSidebar} class:has-search={showSearch}>
	{#if showSearch}
		<StreamSearch value={q} controls={resultsId} oninput={setQuery} onclear={clearQuery} />
	{/if}

	<div class="results" id={resultsId}>
		{#if browsing || active}
			<StreamTrackList
				{username}
				query={browsing ? browse : query}
				seed={!browsing && streamSeed?.key === queryKey ? streamSeed : null}
				{profileData}
				{narrow}
				{pending}
				{placeholder}
				emptyLabel={browsing ? 'No tracks match.' : 'No tracks match this stream.'}
			/>
		{:else if profileList}
			{@const list = profileList}
			{@const items = narrow ? list.items.filter((item) => narrow(item)) : list.items}
			{#if items.length === 0}
				<p class="empty" role="status">
					{pending ? 'Searching…' : 'No tracks have been uploaded yet.'}
				</p>
			{:else}
				<InfiniteList {list} moreLabel="Load more">
					<StreamItems {items} {profileData} onremove={(id) => list.remove(id)} />
				</InfiniteList>
			{/if}
		{:else}
			<p class="empty">Stream</p>
		{/if}
	</div>

	{#if showSidebar}
		<StreamSidebar
			{facets}
			artist={pickedArtist}
			genre={pickedGenre}
			onartist={(name) => (pickedArtist = name)}
			ongenre={(name) => (pickedGenre = name)}
		/>
	{/if}
</div>

<style>
	.browse.has-sidebar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--site-sidebar-width);
		column-gap: clamp(1.5rem, 4vw, 2.75rem);
		align-items: start;
	}

	.browse.has-sidebar.has-search {
		grid-template-areas:
			'search sidebar'
			'results sidebar';
	}

	.browse.has-sidebar:not(.has-search) {
		grid-template-areas: 'results sidebar';
	}

	.browse.has-sidebar :global(.search) {
		grid-area: search;
	}

	.browse.has-sidebar .results {
		grid-area: results;
	}

	.browse.has-sidebar :global(.stream-sidebar) {
		grid-area: sidebar;
	}

	.results {
		min-width: 0;
	}

	.empty {
		margin: 0;
		color: var(--muted);
	}

	@media (max-width: 960px) {
		.browse.has-sidebar,
		.browse.has-sidebar.has-search,
		.browse.has-sidebar:not(.has-search) {
			grid-template-columns: minmax(0, 1fr);
			row-gap: 1rem;
			column-gap: 0;
		}

		.browse.has-sidebar.has-search {
			grid-template-areas:
				'search'
				'sidebar'
				'results';
		}

		.browse.has-sidebar:not(.has-search) {
			grid-template-areas:
				'sidebar'
				'results';
		}
	}
</style>
