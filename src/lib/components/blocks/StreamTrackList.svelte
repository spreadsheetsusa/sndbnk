<script>
	import { onMount } from 'svelte';

	import { STREAM_ARTIST_SEP, streamSearchParams } from '#lib/builder/stream-query.js';
	import InfiniteList from '#lib/components/lists/InfiniteList.svelte';
	import TrackCard from '#lib/components/player/TrackCard.svelte';
	import { restorableList } from '#lib/lists/restorable-list.svelte.js';

	/**
	 * @type {{
	 *   username: string,
	 *   query: import('#lib/builder/stream-query.js').StreamQuery,
	 *   seed?: { items: import('#lib/lists/track-list.svelte.js').ListItem[], nextCursor: string | null } | null,
	 *   profileData: Record<string, any>
	 * }}
	 */
	let { username, query, seed = null, profileData } = $props();

	/** @type {HTMLElement | undefined} */
	let box = $state.raw();
	/** @type {{ items: import('#lib/lists/track-list.svelte.js').ListItem[], nextCursor: string | null } | null} */
	let fetched = $state(null);
	let failed = $state(/** @type {string | null} */ (null));

	const page = $derived(seed ?? fetched);

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
			owner: page ? `ready:${page.items.length}:${page.nextCursor ?? ''}` : 'pending'
		}),
		() => page ?? { items: [], nextCursor: null },
		() => box
	);

	const tracks = $derived((paged.current?.items ?? []).filter((item) => item.kind !== 'playlist'));

	/** @type {import('svelte/attachments').Attachment} */
	const captureBox = (node) => {
		box = node;
		return () => {
			if (box === node) box = undefined;
		};
	};

	onMount(() => {
		if (page) return;
		const controller = new AbortController();
		let alive = true;
		const params = new URLSearchParams({
			scope: 'stream',
			username,
			...streamSearchParams(query)
		});
		fetch(`/api/tracks?${params}`, { signal: controller.signal })
			.then(async (res) => {
				if (!res.ok) throw new Error('Could not load this stream.');
				return res.json();
			})
			.then((body) => {
				if (!alive) return;
				fetched = { items: body.items ?? [], nextCursor: body.nextCursor ?? null };
			})
			.catch((err) => {
				if (!alive) return;
				if (err instanceof DOMException && err.name === 'AbortError') return;
				failed = 'Could not load this stream.';
			});
		return () => {
			alive = false;
			controller.abort();
		};
	});
</script>

<div class="results" {@attach captureBox}>
	{#if paged.current && page}
		{#if tracks.length === 0}
			<p class="empty">No tracks match this stream.</p>
		{:else}
			<InfiniteList list={paged.current} moreLabel="Load more">
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
								ondeleted={() => paged.current.remove(item.id)}
							/>
						</li>
					{/each}
				</ul>
			</InfiniteList>
		{/if}
	{:else if failed}
		<p class="empty" role="alert">{failed}</p>
	{:else}
		<p class="empty">Loading…</p>
	{/if}
</div>

<style>
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
