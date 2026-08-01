<script>
	import { invalidateAll } from '$app/navigation';
	import TrackCard from '#lib/components/player/TrackCard.svelte';

	/**
	 * @typedef {Object} FeedTrack
	 * @property {string} id
	 * @property {string} title
	 * @property {string | null} artist
	 * @property {string | null} genre
	 * @property {number | null} durationMs
	 * @property {boolean} hasCover
	 * @property {number} createdAt
	 * @property {string | null} username
	 * @property {string} uploaderName
	 * @property {number[] | null} waveform
	 * @property {number} likeCount
	 * @property {number} commentCount
	 * @property {boolean} likedByViewer
	 * @property {boolean} isOwner
	 */

	/**
	 * @type {{
	 *   initialTracks: FeedTrack[],
	 *   initialCursor: string | null,
	 *   genre: string | null,
	 *   viewerName: string | null,
	 *   viewerImage?: string | null
	 * }}
	 */
	let { initialTracks, initialCursor, genre, viewerName, viewerImage = null } = $props();

	// Seeded once on mount; parent remounts this component via {#key} when loader data changes.
	// svelte-ignore state_referenced_locally
	let tracks = $state(initialTracks);
	// svelte-ignore state_referenced_locally
	let cursor = $state(initialCursor);
	let loadingMore = $state(false);
	let loadError = $state(/** @type {string | null} */ (null));

	async function loadMore() {
		if (!cursor || loadingMore) return;
		loadingMore = true;
		loadError = null;

		try {
			const params = new URLSearchParams({ cursor });
			if (genre) params.set('genre', genre);

			const res = await fetch(`/api/feed?${params}`);
			if (!res.ok) {
				throw new Error('Could not load more tracks.');
			}

			const payload = await res.json();
			tracks = [...tracks, ...payload.tracks];
			cursor = payload.nextCursor ?? null;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not load more tracks.';
		} finally {
			loadingMore = false;
		}
	}
</script>

{#if tracks.length === 0}
	<div class="empty" aria-live="polite">
		<p>
			{#if genre}
				No tracks in this genre yet.
			{:else}
				No tracks yet. Be the first to upload.
			{/if}
		</p>
		<a class="pressable" href="/library/new">Upload track</a>
	</div>
{:else}
	<ul class="track-list">
		{#each tracks as track (track.id)}
			<li>
				<TrackCard
					{track}
					signedIn={true}
					{viewerName}
					{viewerImage}
					ondeleted={() => invalidateAll()}
				/>
			</li>
		{/each}
	</ul>

	{#if cursor}
		<div class="load-more">
			<button type="button" class="pressable" disabled={loadingMore} onclick={loadMore}>
				{loadingMore ? 'Loading…' : 'Load more'}
			</button>
			{#if loadError}
				<p class="load-error" role="alert">{loadError}</p>
			{/if}
		</div>
	{/if}
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
		box-shadow: 5px 5px 0 var(--ink);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
	}

	.pressable:disabled {
		opacity: 0.55;
		cursor: wait;
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

	.load-more {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
		margin-top: 1.75rem;
	}

	.load-error {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
