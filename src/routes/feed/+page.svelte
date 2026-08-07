<script>
	import { tick } from 'svelte';
	import IconSearch from '@tabler/icons-svelte-runes/icons/search';
	import IconX from '@tabler/icons-svelte-runes/icons/x';

	import FeedSidebar from '#lib/components/feed/FeedSidebar.svelte';
	import FeedTrackList from '#lib/components/feed/FeedTrackList.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { restorableList } from '#lib/lists/restorable-list.svelte.js';

	let { data } = $props();

	/** @type {HTMLElement | undefined} */
	let container;

	/** @type {HTMLInputElement | undefined} */
	let searchInput;

	let searchManuallyOpen = $state(false);
	const searchOpen = $derived(searchManuallyOpen || Boolean(data.q));

	const paged = restorableList(
		() => ({ scope: 'feed', genre: data.genre, following: data.following, q: data.q }),
		() => data,
		() => container
	);

	export const snapshot = paged.snapshot;

	/**
	 * @param {{ genre?: string | null, following?: boolean, q?: string | null }} [opts]
	 */
	function feedHref({ genre = null, following: scopeFollowing = false, q = null } = {}) {
		const params = new URLSearchParams();
		if (scopeFollowing) params.set('following', '1');
		if (genre) params.set('genre', genre);
		if (q) params.set('q', q);
		const qs = params.toString();
		return qs ? `/feed?${qs}` : '/feed';
	}

	function isCompactSearchViewport() {
		return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
	}

	/** @param {MouseEvent & { currentTarget: HTMLButtonElement }} e */
	async function onSearchButtonClick(e) {
		if (!searchOpen && isCompactSearchViewport()) {
			searchManuallyOpen = true;
			await tick();
			searchInput?.focus({ preventScroll: true });
			return;
		}
		e.currentTarget.form?.requestSubmit();
	}

	/** @param {FocusEvent} e */
	function onSearchFocusOut(e) {
		const form = /** @type {HTMLFormElement} */ (e.currentTarget);
		const next = /** @type {Node | null} */ (e.relatedTarget);
		if (next && form.contains(next)) return;
		// Defer so a just-opened field can take focus before we decide to collapse.
		queueMicrotask(() => {
			if (data.q) return;
			if (form.contains(document.activeElement)) return;
			const value = searchInput?.value?.trim() ?? '';
			if (!value) searchManuallyOpen = false;
		});
	}
</script>

<svelte:head>
	<title>Feed | SNDBNK</title>
	<meta name="description" content="Browse the latest tracks posted on SNDBNK." />
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="feed-page">
	<SiteHeader />

	<main>
		<div class="feed-grid">
			<!-- Main column wraps head + list so the tall sidebar cannot stretch a
			     spanning list row (CSS grid was inventing a large gap above few tracks). -->
			<div class="feed-main">
				<header class="feed-head">
					<div class="feed-titles">
						<p class="eyebrow eyebrow-chip accent-text">Feed</p>
						<h1 id="feed-heading" class="display-face">
							{data.following ? 'Your Follows' : 'The Feed'}
						</h1>
					</div>

					<p class="intro">
						{#if data.following}
							Tracks and reposts from the {data.followingCount ?? 0} creator{data.followingCount ===
							1
								? ''
								: 's'} you follow — newest first.
						{:else}
							An aggregation of everything people are posting — newest first.
						{/if}
					</p>

					<div class="scope-row">
						<nav class="scope-strip" aria-label="Feed scope">
							<a
								class="scope-btn"
								href={feedHref({ genre: data.genre, q: data.q })}
								aria-current={data.following ? undefined : 'page'}
							>
								All
							</a>
							<a
								class="scope-btn"
								href={feedHref({ genre: data.genre, following: true, q: data.q })}
								aria-current={data.following ? 'page' : undefined}
							>
								Following
							</a>
						</nav>

						<form
							class="feed-search"
							class:is-open={searchOpen}
							method="get"
							action="/feed"
							role="search"
							onfocusout={onSearchFocusOut}
						>
							{#if data.following}
								<input type="hidden" name="following" value="1" />
							{/if}
							{#if data.genre}
								<input type="hidden" name="genre" value={data.genre} />
							{/if}
							<label class="visually-hidden" for="feed-q">Search the feed</label>
							<div class="feed-search-field">
								<input
									id="feed-q"
									bind:this={searchInput}
									name="q"
									type="search"
									value={data.q ?? ''}
									placeholder="Title, artist, @user, genre"
									autocomplete="off"
									maxlength="80"
									class:has-clear={Boolean(data.q)}
								/>
								{#if data.q}
									<a
										class="feed-search-clear"
										href={feedHref({ genre: data.genre, following: data.following })}
										aria-label="Clear search"
									>
										<IconX size={14} stroke={2} aria-hidden="true" />
									</a>
								{/if}
							</div>
							<button type="button" aria-label="Search" onclick={onSearchButtonClick}>
								<IconSearch size={16} stroke={2} aria-hidden="true" />
							</button>
						</form>
					</div>

					{#if data.genre}
						<div class="filter-chips" aria-live="polite">
							<p class="filter-chip">
								<span>Genre: <strong>{data.genre}</strong></span>
								<a href={feedHref({ following: data.following, q: data.q })}>Clear</a>
							</p>
						</div>
					{/if}
				</header>

				<section class="feed-list" aria-labelledby="feed-heading" bind:this={container}>
					<FeedTrackList
						list={paged.current}
						genre={data.genre}
						q={data.q}
						following={data.following}
						viewerName={data.user.name}
						viewerImage={data.user.image}
					/>
				</section>
			</div>

			<FeedSidebar
				mostLiked={data.sidebar.mostLiked}
				newArtists={data.sidebar.newArtists}
				recentComments={data.sidebar.recentComments}
				genres={data.sidebar.genres}
				activeGenre={data.genre}
				following={data.following}
				q={data.q}
				signedIn={true}
			/>
		</div>
	</main>
</div>

<style>
	.feed-page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 4rem;
	}

	main {
		width: min(100%, var(--site-content-max-wide));
		margin: 0 auto;
		padding-top: clamp(0.75rem, 2vw, 1.25rem);
	}

	.feed-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--site-sidebar-width);
		gap: clamp(2rem, 5vw, 3rem);
		align-items: start;
		animation: rise 0.8s ease both;
	}

	.feed-main {
		display: flex;
		flex-direction: column;
		gap: clamp(2rem, 5vw, 3rem);
		min-width: 0;
	}

	.feed-head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas:
			'titles scope'
			'intro intro'
			'filter filter';
		column-gap: 1rem;
		row-gap: 0;
		align-items: end;
		margin-bottom: 0;
	}

	.feed-list {
		min-width: 0;
	}

	.feed-titles {
		grid-area: titles;
		min-width: 0;
	}

	.feed-titles > .eyebrow {
		margin: 0 0 0.35rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.4rem, 6vw, 3.75rem);
		line-height: 0.95;
		animation: rise 0.65s ease both;
	}

	.intro {
		grid-area: intro;
		max-width: 34rem;
		margin: 0.4rem 0 0;
		color: var(--muted);
		line-height: 1.4;
		animation: rise 0.75s ease 0.05s both;
	}

	.scope-row {
		grid-area: scope;
		display: flex;
		flex-wrap: nowrap;
		gap: 0.65rem;
		align-items: center;
		justify-content: flex-end;
		justify-self: end;
		margin: 0;
		animation: rise 0.8s ease both;
	}

	.scope-strip {
		display: flex;
		flex: 0 0 auto;
		width: auto;
		max-width: 16rem;
		border: 1px solid var(--hard-border);
		box-shadow: 3px 3px 0 var(--hard-shadow);
	}

	.scope-btn {
		display: inline-flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		min-height: 2.25rem;
		padding: 0.4rem 1rem;
		border-right: 1px solid var(--hard-border);
		color: var(--ink);
		background: color-mix(in srgb, var(--paper) 88%, var(--ink));
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		line-height: 1;
		text-decoration: none;
		text-transform: uppercase;
		transition:
			transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1),
			background 120ms ease,
			box-shadow 120ms ease,
			color 120ms ease;
	}

	.scope-btn:last-child {
		border-right: 0;
	}

	.scope-btn:hover {
		background: color-mix(in srgb, var(--accent) 35%, var(--paper));
	}

	.scope-btn[aria-current='page'] {
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: inset 2px 2px 0 color-mix(in srgb, var(--ink) 35%, transparent);
		transform: translate(1px, 1px);
	}

	.feed-search {
		--feed-search-h: 2.25rem;
		display: flex;
		flex: 0 1 16.5rem;
		align-items: stretch;
		min-width: 0;
		max-width: 16.5rem;
		border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--ink));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 8%, var(--paper));
		box-shadow: 3px 3px 0 var(--hard-shadow);
	}

	.feed-search-field {
		position: relative;
		display: flex;
		flex: 1 1 auto;
		align-items: stretch;
		min-width: 0;
	}

	.feed-search input[type='search'] {
		display: block;
		box-sizing: border-box;
		width: 100%;
		height: var(--feed-search-h);
		min-width: 0;
		margin: 0;
		/* Slight top padding offsets Inter's high optical center in this tall field. */
		padding: 0.12rem 0.65rem 0;
		border: 0;
		border-radius: 0.125rem 0 0 0.125rem;
		color: var(--ink);
		background: transparent;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 500;
		line-height: calc(var(--feed-search-h) - 0.12rem);
		outline: none;
		appearance: none;
	}

	.feed-search input[type='search'].has-clear {
		padding-right: 1.85rem;
	}

	.feed-search input[type='search']::placeholder {
		color: var(--muted);
		opacity: 0.9;
	}

	.feed-search input[type='search']::-webkit-search-cancel-button {
		appearance: none;
	}

	.feed-search-clear {
		position: absolute;
		top: 50%;
		right: 0.2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border: 0;
		border-radius: 0.125rem;
		color: var(--muted);
		background: transparent;
		transform: translateY(-50%);
		text-decoration: none;
	}

	.feed-search-clear:hover {
		color: var(--ink);
		background: color-mix(in srgb, var(--ink) 10%, transparent);
	}

	.feed-search button {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		min-width: 2.25rem;
		min-height: var(--feed-search-h);
		padding: 0 0.55rem;
		border: 0;
		border-left: 1px solid color-mix(in srgb, var(--accent) 35%, var(--ink));
		border-radius: 0 0.125rem 0.125rem 0;
		color: var(--ink);
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		cursor: pointer;
	}

	.feed-search button:hover {
		background: color-mix(in srgb, var(--accent) 28%, transparent);
	}

	.feed-search:focus-within {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.filter-chips {
		grid-area: filter;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.85rem 0 0;
		animation: rise 0.8s ease both;
	}

	.filter-chip {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		margin: 0;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--ink);
		background: color-mix(in srgb, var(--paper) 88%, var(--ink));
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.filter-chip a {
		color: var(--ink);
		font-weight: 900;
		text-decoration: underline;
		text-underline-offset: 0.2em;
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

	@media (max-width: 960px) {
		.feed-grid {
			display: flex;
			flex-direction: column;
			gap: 1.25rem;
		}

		/* Flatten so sidebar can sit between head and list (mobile snap rail). */
		.feed-main {
			display: contents;
		}

		.feed-head {
			order: 1;
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				'titles scope'
				'intro intro'
				'filter filter';
			column-gap: 0.65rem;
		}

		.feed-grid :global(.feed-sidebar) {
			order: 2;
		}

		.feed-list {
			order: 3;
		}

		.scope-row {
			gap: 0.5rem;
		}

		.scope-strip {
			max-width: none;
		}

		.scope-btn {
			min-height: 2rem;
			padding: 0.35rem 0.7rem;
			font-size: 0.65rem;
		}
	}

	@media (max-width: 640px) {
		main {
			padding-top: 0.5rem;
		}

		/* Break out of the page shell so listings use the phone viewport; a
		   tight pad keeps titles/waveforms off the glass. Head stays guttered. */
		.feed-list {
			margin-inline: calc(-1 * var(--site-shell-pad-x));
			padding-inline: 0.5rem;
		}

		h1 {
			font-size: clamp(2rem, 8vw, 3.75rem);
		}

		.intro {
			display: none;
		}

		.feed-search:not(.is-open) {
			flex: 0 0 auto;
			max-width: none;
		}

		.feed-search:not(.is-open) .feed-search-field {
			display: none;
		}

		.feed-search:not(.is-open) button {
			border-left: 0;
			border-radius: 0.125rem;
		}

		.feed-search.is-open {
			flex: 1 1 auto;
			min-width: 0;
			max-width: none;
		}
	}

	@media (pointer: coarse) {
		.feed-search {
			--feed-search-h: var(--tap-min);
		}

		.scope-btn,
		.feed-search,
		.feed-search button {
			min-height: var(--tap-min);
		}

		.feed-search-clear {
			width: var(--tap-min);
			height: var(--tap-min);
			right: 0;
		}

		.feed-search input[type='search'].has-clear {
			padding-right: calc(var(--tap-min) + 0.15rem);
		}
	}
</style>
