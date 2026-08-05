<script>
	import IconList from '@tabler/icons-svelte-runes/icons/list';
	import IconPlaylistAdd from '@tabler/icons-svelte-runes/icons/playlist-add';
	import IconUpload from '@tabler/icons-svelte-runes/icons/upload';
	import { MediaQuery } from 'svelte/reactivity';

	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import InfiniteList from '#lib/components/lists/InfiniteList.svelte';
	import HostedQuotaMeter from '#lib/components/library/HostedQuotaMeter.svelte';
	import LibraryDeck from '#lib/components/library/LibraryDeck.svelte';
	import LibraryMediaSidebar from '#lib/components/library/LibraryMediaSidebar.svelte';
	import LibraryTrackRow from '#lib/components/library/LibraryTrackRow.svelte';
	import { restorableList } from '#lib/lists/restorable-list.svelte.js';

	let { data } = $props();

	/** @type {HTMLElement | undefined} */
	let container;

	const paged = restorableList(
		() => ({ scope: 'library', owner: data.user.id }),
		() => data,
		() => container
	);
	const libraryList = $derived(paged.current);

	export const snapshot = paged.snapshot;

	/**
	 * @typedef {{
	 *   id: string,
	 *   title: string,
	 *   published: boolean,
	 *   createdAt: number,
	 *   trackCount: number
	 * }} PlaylistSummary
	 */

	/** @type {PlaylistSummary[] | null} */
	let playlistOverride = $state(null);
	const playlists = $derived(playlistOverride ?? data.playlists);

	/** @type {string | null} */
	let activePlaylistId = $state(null);
	const activePlaylist = $derived(
		activePlaylistId ? (playlists.find((pl) => pl.id === activePlaylistId) ?? null) : null
	);

	/** @type {import('#lib/lists/track-list.svelte.js').ListItem[]} */
	let playlistItems = $state([]);
	let playlistLoading = $state(false);
	/** @type {string | null} */
	let playlistError = $state(null);
	/** Tracks which playlist `playlistItems` belongs to. */
	let loadedPlaylistId = $state(/** @type {string | null} */ (null));

	const isMobile = new MediaQuery('(max-width: 960px)', false);
	let mediaOpen = $state(false);

	/** @type {string | null} */
	let selectedId = $state(null);

	const visibleItems = $derived(activePlaylistId == null ? libraryList.items : playlistItems);
	const resolvedId = $derived(
		visibleItems.some((track) => track.id === selectedId)
			? selectedId
			: (visibleItems[0]?.id ?? null)
	);
	const selected = $derived(visibleItems.find((track) => track.id === resolvedId) ?? null);

	const sourceLabel = $derived(activePlaylist?.title ?? 'All Media');

	/**
	 * @param {string | null} playlistId
	 */
	async function selectSource(playlistId) {
		activePlaylistId = playlistId;
		if (isMobile.current) mediaOpen = false;

		if (playlistId == null) {
			playlistError = null;
			return;
		}

		if (loadedPlaylistId === playlistId && !playlistError) return;

		playlistLoading = true;
		playlistError = null;
		playlistItems = [];
		loadedPlaylistId = playlistId;
		try {
			const res = await fetch(`/api/playlists/${playlistId}/tracks`);
			if (!res.ok) {
				playlistError = 'Could not load playlist tracks.';
				playlistItems = [];
				return;
			}
			const body = await res.json();
			if (activePlaylistId !== playlistId) return;
			playlistItems = body.items ?? [];
		} catch {
			if (activePlaylistId !== playlistId) return;
			playlistError = 'Could not load playlist tracks.';
			playlistItems = [];
		} finally {
			if (loadedPlaylistId === playlistId) playlistLoading = false;
		}
	}

	/** @param {PlaylistSummary} playlist */
	function handleCreated(playlist) {
		playlistOverride = [playlist, ...(playlistOverride ?? data.playlists)];
		loadedPlaylistId = playlist.id;
		playlistItems = [];
		playlistError = null;
		playlistLoading = false;
	}

	/** @param {string} playlistId */
	function handleDeleted(playlistId) {
		playlistOverride = (playlistOverride ?? data.playlists).filter((pl) => pl.id !== playlistId);
		if (activePlaylistId === playlistId) {
			activePlaylistId = null;
			loadedPlaylistId = null;
			playlistItems = [];
			playlistError = null;
		}
	}

	/** @param {KeyboardEvent} event */
	function handleWindowKeydown(event) {
		if (event.key === 'Escape' && mediaOpen && isMobile.current) {
			mediaOpen = false;
		}
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<svelte:head>
	<title>Music Library | SNDBNK</title>
	<meta name="description" content="Your private SNDBNK track library." />
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="library-page">
	<SiteHeader />

	<main>
		<header class="page-head">
			<div class="page-head-copy">
				<p class="eyebrow eyebrow-chip accent-text">@{data.profile.username}</p>
				<h1 id="tracks-heading" class="display-face">
					<span class="title-music">Music&nbsp;</span>Library
				</h1>
				<p class="intro">Upload, organize, and manage the audio in your private library.</p>
			</div>
			<div class="page-head-actions">
				<div class="page-head-buttons">
					<a
						class="pressable secondary icon-only"
						href="/playlists/new"
						aria-label="New playlist"
						title="New playlist"
					>
						<IconPlaylistAdd size={18} stroke={1.75} aria-hidden="true" />
					</a>
					<a class="pressable" href="/library/new">
						<IconUpload size={16} stroke={1.75} aria-hidden="true" />
						Upload
					</a>
				</div>
				<div class="page-head-quota">
					<HostedQuotaMeter
						localBytes={data.usage.localBytes}
						maxLocalBytes={data.usage.maxLocalBytes}
						planLabel={data.usage.planLabel}
					/>
				</div>
			</div>
		</header>

		<LibraryDeck track={selected} visualizerBackdrop />

		<section class="block" aria-labelledby="tracks-heading">
			<div class="media-shell" class:overlay-open={mediaOpen}>
				{#if isMobile.current && mediaOpen}
					<button
						type="button"
						class="media-scrim"
						aria-label="Close media browser"
						onclick={() => (mediaOpen = false)}
					></button>
				{/if}

				<aside
					id="library-media-nav"
					class="media-aside"
					class:open={mediaOpen || !isMobile.current}
					aria-hidden={isMobile.current && !mediaOpen ? 'true' : undefined}
				>
					<LibraryMediaSidebar
						{playlists}
						{activePlaylistId}
						onselect={selectSource}
						oncreated={handleCreated}
						ondeleted={handleDeleted}
					/>
				</aside>

				<div class="media-main" bind:this={container}>
					<div class="media-toolbar">
						<button
							type="button"
							class="media-toggle"
							aria-expanded={mediaOpen}
							aria-controls="library-media-nav"
							onclick={() => (mediaOpen = !mediaOpen)}
						>
							<IconList size={16} stroke={1.75} aria-hidden="true" />
							<span class="media-toggle-label">{sourceLabel}</span>
						</button>
						{#if activePlaylist}
							<a class="edit-link" href="/playlists/{activePlaylist.id}/edit">Edit playlist</a>
						{/if}
					</div>

					{#if activePlaylistId == null}
						{#if libraryList.items.length === 0}
							<div class="empty" aria-live="polite">
								<p>No tracks yet. Upload your first one to get started.</p>
								<a class="pressable" href="/library/new">
									<IconUpload size={16} stroke={1.75} aria-hidden="true" />
									Upload
								</a>
							</div>
						{:else}
							<InfiniteList list={libraryList}>
								<div class="track-table">
									<div class="table-head" aria-hidden="true">
										<span></span>
										<span></span>
										<span>Track</span>
										<span class="col-genre">Genre</span>
										<span class="col-duration">Time</span>
										<span class="col-stats">Activity</span>
										<span class="col-added">Added</span>
										<span class="col-published">Published</span>
										<span></span>
									</div>
									<ul>
										{#each libraryList.items as track (track.id)}
											<li data-cursor={track.cursor}>
												<LibraryTrackRow
													{track}
													selected={track.id === resolvedId}
													onselect={() => (selectedId = track.id)}
													ondeleted={() => libraryList.remove(track.id)}
												/>
											</li>
										{/each}
									</ul>
								</div>
							</InfiniteList>
						{/if}
					{:else if playlistLoading}
						<div class="empty" aria-live="polite">
							<p>Loading playlist…</p>
						</div>
					{:else if playlistError}
						<div class="empty" aria-live="polite">
							<p>{playlistError}</p>
							<button
								type="button"
								class="pressable secondary"
								onclick={() => selectSource(activePlaylistId)}
							>
								Retry
							</button>
						</div>
					{:else if playlistItems.length === 0}
						<div class="empty" aria-live="polite">
							<p>No tracks in this playlist yet.</p>
							{#if activePlaylist}
								<a class="pressable secondary" href="/playlists/{activePlaylist.id}/edit">
									Edit playlist
								</a>
							{/if}
						</div>
					{:else}
						<div class="track-table">
							<div class="table-head" aria-hidden="true">
								<span></span>
								<span></span>
								<span>Track</span>
								<span class="col-genre">Genre</span>
								<span class="col-duration">Time</span>
								<span class="col-stats">Activity</span>
								<span class="col-added">Added</span>
								<span class="col-published">Published</span>
								<span></span>
							</div>
							<ul>
								{#each playlistItems as track (track.id)}
									<li>
										<LibraryTrackRow
											{track}
											selected={track.id === resolvedId}
											onselect={() => (selectedId = track.id)}
											ondeleted={() => {
												playlistItems = playlistItems.filter((item) => item.id !== track.id);
												if (playlistOverride) {
													playlistOverride = playlistOverride.map((pl) =>
														pl.id === activePlaylistId
															? { ...pl, trackCount: Math.max(0, pl.trackCount - 1) }
															: pl
													);
												} else {
													playlistOverride = data.playlists.map((pl) =>
														pl.id === activePlaylistId
															? { ...pl, trackCount: Math.max(0, pl.trackCount - 1) }
															: pl
													);
												}
											}}
										/>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</div>
		</section>
	</main>
</div>

<style>
	.library-page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 4rem;
	}

	main {
		display: grid;
		gap: 1rem;
		width: min(100%, var(--site-content-max-wide));
		margin: 0 auto;
		padding-top: clamp(0.75rem, 2vw, 1.25rem);
	}

	.page-head {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 1.5rem;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.page-head-copy {
		min-width: 0;
		flex: 1 1 16rem;
	}

	.page-head-actions {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		gap: 0.65rem;
		align-items: flex-end;
		margin-left: auto;
	}

	.page-head-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		justify-content: flex-end;
	}

	.page-head-copy > .eyebrow {
		margin: 0 0 0.35rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.4rem, 6vw, 3.75rem);
		line-height: 0.95;
		animation: rise 0.65s ease both;
	}

	.title-music {
		display: none;
	}

	@media (min-width: 768px) {
		.title-music {
			display: inline;
		}
	}

	.intro {
		max-width: 34rem;
		margin: 0.4rem 0 0;
		color: var(--muted);
		line-height: 1.4;
		animation: rise 0.75s ease 0.05s both;
	}

	.block {
		margin-top: 0.5rem;
		background: var(--paper);
		animation: rise 0.8s ease both;
	}

	.media-shell {
		position: relative;
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		gap: 0;
		align-items: stretch;
		min-height: 12rem;
		border: 1px solid var(--hard-border);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		overflow: hidden;
	}

	.media-aside {
		min-width: 0;
		border-right: 1px solid var(--hard-border);
		background: color-mix(in srgb, var(--ink) 2.5%, var(--paper));
	}

	:global(.dark) .media-aside {
		background: color-mix(in srgb, var(--accent) 6%, #0a0a0a);
	}

	.media-main {
		min-width: 0;
		background: var(--paper);
	}

	.media-toolbar {
		display: none;
		gap: 0.65rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.45rem 0.55rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.media-toggle {
		display: inline-flex;
		gap: 0.45rem;
		align-items: center;
		min-width: 0;
		min-height: 2.4rem;
		padding: 0.35rem 0.65rem;
		border: 1px solid var(--hard-border);
		color: var(--ink);
		background: var(--paper);
		box-shadow: 2px 2px 0 var(--hard-shadow);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.media-toggle[aria-expanded='true'] {
		box-shadow: inset 2px 2px 0 color-mix(in srgb, var(--ink) 30%, transparent);
	}

	.media-toggle-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.edit-link {
		flex-shrink: 0;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}

	.edit-link:hover {
		color: var(--accent);
	}

	.media-scrim {
		display: none;
	}

	.pressable {
		display: inline-flex;
		gap: 0.4rem;
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

	.pressable.secondary {
		color: var(--ink);
		background: var(--paper);
	}

	.pressable.icon-only {
		width: 3.1rem;
		padding: 0;
	}

	.empty {
		padding: 1.25rem;
		border: 1px dashed color-mix(in srgb, var(--ink) 35%, transparent);
		margin: 0.75rem;
	}

	.empty p {
		margin: 0 0 1rem;
		color: var(--muted);
		line-height: 1.5;
	}

	/* Shared by the header strip and every row so the columns cannot drift apart. */
	.track-table {
		--library-grid: 1.7rem 1.75rem minmax(0, 1fr) minmax(0, 8rem) 4rem 5.5rem 6rem 4.8rem 1.7rem;
	}

	.table-head {
		display: grid;
		grid-template-columns: var(--library-grid);
		gap: 0.6rem;
		align-items: center;
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 25%, transparent);
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.table-head .col-duration {
		text-align: right;
	}

	.track-table ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Rows off-screen skip layout and paint; `auto` remembers each measured
	   height so scrolling back up lands where it should. */
	.track-table li {
		content-visibility: auto;
		contain-intrinsic-size: auto 2.6rem;
	}

	/* `content-visibility: auto` paint-contains the row and clips the absolute
	   menu; drop containment for the open row and stack it above neighbors.
	   `.more-btn` is in LibraryTrackRow, so it must be `:global` here. */
	.track-table li:has(:global(.more-btn[aria-expanded='true'])) {
		position: relative;
		z-index: 2;
		content-visibility: visible;
	}

	@media (max-width: 960px) {
		.media-shell {
			grid-template-columns: minmax(0, 1fr);
			overflow: hidden;
		}

		.media-toolbar {
			display: flex;
		}

		.media-aside {
			position: absolute;
			top: 0;
			bottom: 0;
			left: 0;
			z-index: 5;
			width: min(16.5rem, 84%);
			border-right: 1px solid var(--hard-border);
			box-shadow: 6px 0 0 color-mix(in srgb, var(--hard-shadow) 55%, transparent);
			transform: translateX(-105%);
			visibility: hidden;
			pointer-events: none;
			transition:
				transform 0.22s ease,
				visibility 0.22s;
		}

		.media-aside.open {
			transform: translateX(0);
			visibility: visible;
			pointer-events: auto;
		}

		.media-scrim {
			display: block;
			position: absolute;
			inset: 0;
			z-index: 4;
			border: 0;
			background: color-mix(in srgb, var(--ink) 28%, transparent);
			cursor: pointer;
		}

		.track-table {
			--library-grid: 1.7rem 1.75rem minmax(0, 1fr) minmax(0, 8rem) 4rem 4.8rem 1.7rem;
		}

		.table-head .col-stats,
		.table-head .col-added {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.media-aside {
			transition: none;
		}
	}

	@media (max-width: 640px) {
		main {
			padding-top: 0.5rem;
		}

		.page-head {
			flex-wrap: nowrap;
			gap: 0.75rem 1rem;
		}

		.page-head-copy {
			flex: 1 1 0;
		}

		.page-head-copy > .eyebrow {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		h1 {
			font-size: clamp(1.85rem, 6vw, 3.75rem);
		}

		.intro {
			display: none;
		}

		.page-head-quota {
			display: none;
		}

		.table-head {
			display: none;
		}

		.track-table li {
			contain-intrinsic-size: auto 3.25rem;
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.6rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
