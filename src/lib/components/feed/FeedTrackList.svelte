<script>
	import InfiniteList from '#lib/components/lists/InfiniteList.svelte';
	import PlaylistCard from '#lib/components/player/PlaylistCard.svelte';
	import TrackCard from '#lib/components/player/TrackCard.svelte';

	/**
	 * @type {{
	 *   list: import('#lib/lists/track-list.svelte.js').TrackList,
	 *   genre: string | null,
	 *   following?: boolean,
	 *   viewerName: string | null,
	 *   viewerImage?: string | null
	 * }}
	 */
	let { list, genre, following = false, viewerName, viewerImage = null } = $props();
</script>

{#if list.items.length === 0}
	<div class="empty" aria-live="polite">
		<p>
			{#if following}
				Nothing from the people you follow yet. Follow more creators to fill this out.
			{:else if genre}
				No tracks in this genre yet.
			{:else}
				No tracks yet. Be the first to upload.
			{/if}
		</p>
		<a class="pressable" href="/library/new">Upload track</a>
	</div>
{:else}
	<InfiniteList {list} endLabel="You're all caught up">
		<ul class="track-list">
			{#each list.items as item (item.id)}
				<li data-cursor={item.cursor}>
					{#if item.kind === 'playlist'}
						<PlaylistCard
							playlist={item}
							signedIn={true}
							{viewerName}
							{viewerImage}
							ondeleted={() => list.remove(item.id)}
						/>
					{:else}
						<TrackCard
							track={item}
							signedIn={true}
							{viewerName}
							{viewerImage}
							ondeleted={() => list.remove(item.id)}
						/>
					{/if}
				</li>
			{/each}
		</ul>
	</InfiniteList>
{/if}

<style>
	.pressable {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		min-height: 3.1rem;
		padding: 0 1.1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
	}

	.empty {
		margin-top: 1.5rem;
		padding: 1.25rem;
		border: 1px dashed var(--ink);
	}

	.empty p {
		margin: 0 0 1rem;
		color: var(--muted);
		line-height: 1.5;
	}

	.track-list {
		display: grid;
		gap: 1rem;
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
	}

	/* Off-screen cards skip layout and paint entirely; `auto` keeps each row's
	   real height once measured, so scrolling back up lands where it should. */
	.track-list li {
		content-visibility: auto;
		contain-intrinsic-size: auto 192px;
	}

	/* `content-visibility: auto` paint-contains the row and clips the absolute
	   menu; drop containment for the open row and stack it above neighbors.
	   `.more-btn` is in TrackCard, so it must be `:global` here. */
	.track-list li:has(:global(.more-btn[aria-expanded='true'])) {
		position: relative;
		z-index: 2;
		content-visibility: visible;
	}
</style>
