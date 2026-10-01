<script>
	import InfiniteList from '#lib/components/lists/InfiniteList.svelte';
	import TrackCard from '#lib/components/player/TrackCard.svelte';

	/**
	 * @type {{
	 *   profileData?: Record<string, any> | null,
	 *   profileList?: import('#lib/lists/track-list.svelte.js').TrackList | null
	 * }}
	 */
	let { profileData = null, profileList = null } = $props();

	const tracks = $derived((profileList?.items ?? []).filter((item) => item.kind !== 'playlist'));
</script>

{#if profileData && profileList}
	{@const list = profileList}
	<section class="stream" aria-label="Stream">
		{#if tracks.length === 0}
			<p class="empty">No tracks have been uploaded yet.</p>
		{:else}
			<InfiniteList {list} moreLabel="Load more">
				<ul>
					{#each tracks as item (item.id)}
						<li data-cursor={item.cursor}>
							<TrackCard
								track={item}
								linkBase=""
								hideArtist
								showCommentForm={false}
								signedIn={Boolean(profileData.viewer)}
								viewerId={profileData.viewer?.id ?? null}
								viewerName={profileData.viewer?.name ?? null}
								viewerImage={profileData.viewer?.image ?? null}
								ondeleted={() => list.remove(item.id)}
							/>
						</li>
					{/each}
				</ul>
			</InfiniteList>
		{/if}
	</section>
{:else}
	<section class="stream placeholder" aria-label="Stream">
		<p>Stream</p>
	</section>
{/if}

<style>
	.stream {
		padding: 0.75rem 0 1.25rem;
	}

	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.empty,
	.placeholder p {
		margin: 0;
		color: var(--muted);
	}
</style>
