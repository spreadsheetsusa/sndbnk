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
</script>

<svelte:head>
	<title>Feed | SNDBNK</title>
	<meta name="description" content="Browse the latest tracks posted on SNDBNK." />
</svelte:head>

<div class="feed-page">
	<SiteHeader />

	<main>
		<div class="feed-grid">
			<section class="block" aria-labelledby="feed-heading">
				<header class="feed-head">
					<p class="eyebrow eyebrow-chip accent-text">Feed</p>
					<h1 id="feed-heading" class="display-face">
						{data.following ? 'Your Follows' : 'The Feed'}
					</h1>
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

					{#if data.genre}
						<p class="filter-chip" aria-live="polite">
							<span>Genre: <strong>{data.genre}</strong></span>
							<a href={data.following ? '/feed?following=1' : '/feed'}>Clear filter</a>
						</p>
					{/if}
				</header>

				<div bind:this={container}>
					<FeedTrackList
						list={paged.current}
						genre={data.genre}
						following={data.following}
						viewerName={data.user.name}
						viewerImage={data.user.image}
					/>
				</div>
			</section>

			<FeedSidebar
				mostLiked={data.sidebar.mostLiked}
				newArtists={data.sidebar.newArtists}
				recentComments={data.sidebar.recentComments}
				genres={data.sidebar.genres}
				activeGenre={data.genre}
				following={data.following}
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

	.block {
		min-width: 0;
	}

	.feed-head {
		margin-bottom: 2.5rem;
	}

	.feed-head > .eyebrow {
		margin: 0 0 0.35rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.4rem, 6vw, 3.75rem);
		line-height: 0.95;
		animation: rise 0.65s ease both;
	}

	.intro {
		max-width: 34rem;
		margin: 0.4rem 0 0;
		color: var(--muted);
		line-height: 1.4;
		animation: rise 0.75s ease 0.05s both;
	}

	.filter-chip {
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
		}
	}
</style>
