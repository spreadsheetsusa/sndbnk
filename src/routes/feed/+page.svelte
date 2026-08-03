<script>
	import FeedSidebar from '#lib/components/feed/FeedSidebar.svelte';
	import FeedTrackList from '#lib/components/feed/FeedTrackList.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { restorableList } from '#lib/lists/restorable-list.svelte.js';

	let { data } = $props();

	/** @type {HTMLElement | undefined} */
	let container;

	const paged = restorableList(
		() => ({ scope: 'feed', genre: data.genre, following: data.following }),
		() => data,
		() => container
	);

	export const snapshot = paged.snapshot;

	/**
	 * @param {{ genre?: string | null, following?: boolean }} [opts]
	 */
	function feedHref({ genre = null, following: scopeFollowing = false } = {}) {
		const params = new URLSearchParams();
		if (scopeFollowing) params.set('following', '1');
		if (genre) params.set('genre', genre);
		const qs = params.toString();
		return qs ? `/feed?${qs}` : '/feed';
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
			<header class="feed-head">
				<div class="feed-titles">
					<p class="eyebrow eyebrow-chip accent-text">Feed</p>
					<h1 id="feed-heading" class="display-face">
						{data.following ? 'Your Follows' : 'The Feed'}
					</h1>
				</div>

				<p class="intro">
					{#if data.following}
						Tracks and reposts from the {data.followingCount ?? 0} creator{data.followingCount === 1
							? ''
							: 's'} you follow — newest first.
					{:else}
						An aggregation of everything people are posting — newest first.
					{/if}
				</p>

				<nav class="scope-strip" aria-label="Feed scope">
					<a
						class="scope-btn"
						href={feedHref({ genre: data.genre })}
						aria-current={data.following ? undefined : 'page'}
					>
						All
					</a>
					<a
						class="scope-btn"
						href={feedHref({ genre: data.genre, following: true })}
						aria-current={data.following ? 'page' : undefined}
					>
						Following
					</a>
				</nav>

				{#if data.genre}
					<p class="filter-chip" aria-live="polite">
						<span>Genre: <strong>{data.genre}</strong></span>
						<a href={data.following ? '/feed?following=1' : '/feed'}>Clear filter</a>
					</p>
				{/if}
			</header>

			<FeedSidebar
				mostLiked={data.sidebar.mostLiked}
				newArtists={data.sidebar.newArtists}
				recentComments={data.sidebar.recentComments}
				genres={data.sidebar.genres}
				activeGenre={data.genre}
				following={data.following}
				signedIn={true}
			/>

			<section class="feed-list" aria-labelledby="feed-heading" bind:this={container}>
				<FeedTrackList
					list={paged.current}
					genre={data.genre}
					following={data.following}
					viewerName={data.user.name}
					viewerImage={data.user.image}
				/>
			</section>
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
		grid-template-areas:
			'head side'
			'list side';
		gap: clamp(2rem, 5vw, 3rem);
		align-items: start;
		animation: rise 0.8s ease both;
	}

	.feed-head {
		grid-area: head;
		display: grid;
		grid-template-areas:
			'titles'
			'intro'
			'scope'
			'filter';
		gap: 0;
		margin-bottom: 0;
	}

	.feed-grid :global(.feed-sidebar) {
		grid-area: side;
	}

	.feed-list {
		grid-area: list;
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

	.scope-strip {
		grid-area: scope;
		display: flex;
		width: 100%;
		max-width: 16rem;
		margin: 0.85rem 0 0;
		border: 1px solid var(--hard-border);
		box-shadow: 3px 3px 0 var(--hard-shadow);
		animation: rise 0.8s ease both;
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

	.filter-chip {
		grid-area: filter;
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		margin: 0.85rem 0 0;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--ink);
		background: color-mix(in srgb, var(--paper) 88%, var(--ink));
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		animation: rise 0.8s ease both;
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
			grid-template-columns: 1fr;
			grid-template-areas:
				'head'
				'side'
				'list';
			gap: 1.25rem;
		}

		.feed-head {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				'titles scope'
				'intro intro'
				'filter filter';
			column-gap: 0.75rem;
			align-items: start;
		}

		.scope-strip {
			width: auto;
			max-width: none;
			margin: 0;
			align-self: start;
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

		h1 {
			font-size: clamp(2rem, 8vw, 3.75rem);
		}

		.intro {
			display: none;
		}
	}

	@media (pointer: coarse) {
		.scope-btn {
			min-height: var(--tap-min);
		}
	}
</style>
