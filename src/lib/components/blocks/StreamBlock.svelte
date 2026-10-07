<script>
	import {
		parseStreamChrome,
		parseStreamQuery,
		streamQueryActive,
		streamQueryKey
	} from '#lib/builder/stream-query.js';
	import StreamBrowse from '#lib/components/blocks/StreamBrowse.svelte';
	import StreamItems from '#lib/components/blocks/StreamItems.svelte';
	import StreamTrackList from '#lib/components/blocks/StreamTrackList.svelte';
	import InfiniteList from '#lib/components/lists/InfiniteList.svelte';

	/**
	 * @type {{
	 *   profileData?: Record<string, any> | null,
	 *   profileList?: import('#lib/lists/track-list.svelte.js').TrackList | null,
	 *   streamSeed?: { key: string, items: import('#lib/lists/track-list.svelte.js').ListItem[], nextCursor: string | null } | null,
	 *   streamFacets?: import('#lib/builder/stream-query.js').StreamFacets | null,
	 *   heading?: string,
	 *   headingAlign?: string,
	 *   count?: number | string | null,
	 *   dateFrom?: string,
	 *   dateTo?: string,
	 *   genre?: string,
	 *   artists?: string[] | string,
	 *   mediaType?: string,
	 *   showSearch?: boolean,
	 *   showSidebar?: boolean
	 * }}
	 */
	let {
		profileData = null,
		profileList = null,
		streamSeed = null,
		streamFacets = null,
		heading = '',
		headingAlign = 'left',
		count = null,
		dateFrom = '',
		dateTo = '',
		genre = '',
		artists = undefined,
		mediaType = '',
		showSearch = false,
		showSidebar = false
	} = $props();

	const query = $derived(
		parseStreamQuery({ heading, headingAlign, count, dateFrom, dateTo, genre, artists, mediaType })
	);
	const chrome = $derived(parseStreamChrome({ showSearch, showSidebar }));
	const active = $derived(streamQueryActive(query));
	const queryKey = $derived(streamQueryKey(query));
	const title = $derived(query.heading.trim());
	const headingId = $props.id();
	const resultsId = `${headingId}-results`;
	const username = $derived(
		typeof profileData?.profile?.username === 'string' ? profileData.profile.username : ''
	);
</script>

<section
	class="stream"
	aria-label={title ? undefined : 'Stream'}
	aria-labelledby={title ? headingId : undefined}
>
	{#if title}
		<h2 id={headingId} class={['heading', query.headingAlign]}>{title}</h2>
	{/if}

	{#if profileData && (chrome.showSearch || chrome.showSidebar) && username}
		{#key queryKey}
			<StreamBrowse
				{username}
				{query}
				showSearch={chrome.showSearch}
				showSidebar={chrome.showSidebar}
				{profileData}
				{profileList}
				{streamSeed}
				{streamFacets}
				{resultsId}
			/>
		{/key}
	{:else if profileData && active && username}
		{#key queryKey}
			<StreamTrackList
				{username}
				{query}
				seed={streamSeed?.key === queryKey ? streamSeed : null}
				{profileData}
			/>
		{/key}
	{:else if profileData && profileList}
		{@const list = profileList}
		{#if list.items.length === 0}
			<p class="empty">No tracks have been uploaded yet.</p>
		{:else}
			<InfiniteList {list} moreLabel="Load more">
				<StreamItems items={list.items} {profileData} onremove={(id) => list.remove(id)} />
			</InfiniteList>
		{/if}
	{:else}
		<p class="empty">Stream</p>
	{/if}
</section>

<style>
	.stream {
		container-type: inline-size;
		container-name: stream;
		padding: 0.75rem 0 1.25rem;
	}

	@media (max-width: 640px) {
		.stream {
			padding-inline: 1rem;
		}
	}

	.heading {
		margin: 0 0 1rem;
		font-family: var(--font-editorial);
		font-size: clamp(2rem, 5vw, 3.25rem);
		font-weight: 500;
		line-height: 0.95;
		letter-spacing: -0.03em;
	}

	.heading.center {
		text-align: center;
	}

	.heading.right {
		text-align: right;
	}

	.empty {
		margin: 0;
		color: var(--muted);
	}
</style>
