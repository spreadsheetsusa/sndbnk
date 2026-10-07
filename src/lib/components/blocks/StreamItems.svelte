<script>
	import PlaylistCard from '#lib/components/player/PlaylistCard.svelte';
	import TrackCard from '#lib/components/player/TrackCard.svelte';

	/**
	 * @type {{
	 *   items: Array<Record<string, any>>,
	 *   profileData: Record<string, any>,
	 *   onremove?: (id: string) => void
	 * }}
	 */
	let { items, profileData, onremove } = $props();
</script>

<ul>
	{#each items as item (item.id)}
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
					ondeleted={() => onremove?.(item.id)}
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
					ondeleted={() => onremove?.(item.id)}
				/>
			{/if}
		</li>
	{/each}
</ul>

<style>
	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
