<script>
	import FeedSidebar from '#lib/components/feed/FeedSidebar.svelte';
	import FeedTrackList from '#lib/components/feed/FeedTrackList.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';

	let { data } = $props();

	const listKey = $derived(
		`${data.genre ?? ''}|${data.nextCursor ?? ''}|${data.tracks.map((t) => t.id).join(',')}`
	);
</script>

<svelte:head>
	<title>Feed | SNDBNK</title>
	<meta name="description" content="Browse the latest tracks posted on SNDBNK." />
</svelte:head>

<div class="feed-page">
	<SiteHeader />

	<main>
		<p class="eyebrow eyebrow-chip accent-text">Feed</p>
		<h1 class="display-face">Latest tracks</h1>
		<p class="intro">An aggregation of everything people are posting — newest first.</p>

		{#if data.genre}
			<p class="filter-chip" aria-live="polite">
				<span>Genre: <strong>{data.genre}</strong></span>
				<a href="/feed">Clear filter</a>
			</p>
		{/if}

		<div class="feed-grid">
			<section class="block" aria-labelledby="feed-heading">
				<div class="block-head">
					<p class="eyebrow">01</p>
					<h2 id="feed-heading">Tracks</h2>
					<p>
						{#if data.genre}
							Showing {data.genre} uploads.
						{:else}
							Everything on SNDBNK, ordered by time posted.
						{/if}
					</p>
				</div>

				{#key listKey}
					<FeedTrackList
						initialTracks={data.tracks}
						initialCursor={data.nextCursor}
						genre={data.genre}
						viewerName={data.user.name}
						viewerImage={data.user.image}
					/>
				{/key}
			</section>

			<FeedSidebar
				mostLiked={data.sidebar.mostLiked}
				newArtists={data.sidebar.newArtists}
				recentComments={data.sidebar.recentComments}
				genres={data.sidebar.genres}
				activeGenre={data.genre}
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
		padding-top: clamp(1.25rem, 4vw, 2.5rem);
	}

	main > .eyebrow {
		margin: 0 0 0.75rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(3.2rem, 9vw, 5.5rem);
		line-height: 0.92;
		animation: rise 0.65s ease both;
	}

	.intro {
		max-width: 34rem;
		margin: 1rem 0 0;
		color: var(--muted);
		line-height: 1.5;
		animation: rise 0.75s ease 0.05s both;
	}

	.filter-chip {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		margin: 1.25rem 0 0;
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

	.feed-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: clamp(2rem, 5vw, 3rem);
		align-items: start;
		margin-top: clamp(2.75rem, 7vw, 4rem);
		animation: rise 0.8s ease both;
	}

	.block {
		padding-top: clamp(1.75rem, 4vw, 2.25rem);
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		min-width: 0;
	}

	.block-head h2 {
		margin: 0.35rem 0 0.5rem;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(2rem, 5vw, 2.75rem);
		font-weight: 400;
		letter-spacing: -0.03em;
	}

	.block-head p:last-child {
		margin: 0;
		color: var(--muted);
		line-height: 1.5;
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
