<script>
	import {
		parseStreamQuery,
		streamQueryActive,
		streamQueryKey
	} from '#lib/builder/stream-query.js';
	import StreamTrackList from '#lib/components/blocks/StreamTrackList.svelte';
	import InfiniteList from '#lib/components/lists/InfiniteList.svelte';
	import PlaylistCard from '#lib/components/player/PlaylistCard.svelte';
	import TrackCard from '#lib/components/player/TrackCard.svelte';

	/**
	 * @type {{
	 *   profileData?: Record<string, any> | null,
	 *   profileList?: import('#lib/lists/track-list.svelte.js').TrackList | null,
	 *   streamSeed?: { key: string, items: import('#lib/lists/track-list.svelte.js').ListItem[], nextCursor: string | null } | null,
	 *   heading?: string,
	 *   headingAlign?: string,
	 *   count?: number | string | null,
	 *   dateFrom?: string,
	 *   dateTo?: string,
	 *   genre?: string,
	 *   artists?: string[] | string,
	 *   mediaType?: string
	 * }}
	 */
	let {
		profileData = null,
		profileList = null,
		streamSeed = null,
		heading = '',
		headingAlign = 'left',
		count = null,
		dateFrom = '',
		dateTo = '',
		genre = '',
		artists = undefined,
		mediaType = ''
	} = $props();

	const query = $derived(
		parseStreamQuery({ heading, headingAlign, count, dateFrom, dateTo, genre, artists, mediaType })
	);
	const active = $derived(streamQueryActive(query));
	const queryKey = $derived(streamQueryKey(query));
	const title = $derived(query.heading.trim());
	const headingId = $props.id();
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

	{#if profileData && active && username}
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
				<ul>
					{#each list.items as item (item.id)}
						<li data-cursor={item.cursor}>
							{#if item.kind === 'playlist'}
								<PlaylistCard
									playlist={item}
									linkBase=""
									showCommentForm={false}
									signedIn={Boolean(profileData.viewer)}
									viewerId={profileData.viewer?.id ?? null}
									viewerName={profileData.viewer?.name ?? null}
									viewerImage={profileData.viewer?.image ?? null}
									ondeleted={() => list.remove(item.id)}
								/>
							{:else}
								<TrackCard
									track={item}
									linkBase=""
									hideArtist
									stream
									showCommentForm={false}
									signedIn={Boolean(profileData.viewer)}
									viewerId={profileData.viewer?.id ?? null}
									viewerName={profileData.viewer?.name ?? null}
									viewerImage={profileData.viewer?.image ?? null}
									ondeleted={() => list.remove(item.id)}
								/>
							{/if}
						</li>
					{/each}
				</ul>
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

	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.empty {
		margin: 0;
		color: var(--muted);
	}
</style>
