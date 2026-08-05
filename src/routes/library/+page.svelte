<script>
	import IconPlaylistAdd from '@tabler/icons-svelte-runes/icons/playlist-add';
	import IconUpload from '@tabler/icons-svelte-runes/icons/upload';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import InfiniteList from '#lib/components/lists/InfiniteList.svelte';
	import HostedQuotaMeter from '#lib/components/library/HostedQuotaMeter.svelte';
	import LibraryDeck from '#lib/components/library/LibraryDeck.svelte';
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
	const list = $derived(paged.current);

	export const snapshot = paged.snapshot;

	/** @type {string | null} */
	let selectedId = $state(null);
	const resolvedId = $derived(
		list.items.some((track) => track.id === selectedId) ? selectedId : (list.items[0]?.id ?? null)
	);
	const selected = $derived(list.items.find((track) => track.id === resolvedId) ?? null);
</script>

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

		<section class="block" aria-labelledby="tracks-heading" bind:this={container}>
			{#if list.items.length === 0}
				<div class="empty" aria-live="polite">
					<p>No tracks yet. Upload your first one to get started.</p>
					<a class="pressable" href="/library/new">
						<IconUpload size={16} stroke={1.75} aria-hidden="true" />
						Upload
					</a>
				</div>
			{:else}
				<InfiniteList {list}>
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
							{#each list.items as track (track.id)}
								<li data-cursor={track.cursor}>
									<LibraryTrackRow
										{track}
										selected={track.id === resolvedId}
										onselect={() => (selectedId = track.id)}
										ondeleted={() => list.remove(track.id)}
									/>
								</li>
							{/each}
						</ul>
					</div>
				</InfiniteList>
			{/if}
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
		width: min(100%, var(--site-content-max));
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
		border: 1px dashed var(--ink);
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
		.track-table {
			--library-grid: 1.7rem 1.75rem minmax(0, 1fr) minmax(0, 8rem) 4rem 4.8rem 1.7rem;
		}

		.table-head .col-stats,
		.table-head .col-added {
			display: none;
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
