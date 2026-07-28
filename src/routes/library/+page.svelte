<script>
	import { invalidateAll } from '$app/navigation';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import TrackCard from '#lib/components/player/TrackCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Your tracks | SNDBNK</title>
	<meta name="description" content="Your private SNDBNK track library." />
</svelte:head>

<div class="library-page">
	<SiteHeader />

	<main>
		<p class="eyebrow eyebrow-chip accent-text">Library</p>
		<h1 class="display-face">Your tracks</h1>
		<p class="intro">Upload, organize, and manage the audio in your private library.</p>

		<section class="block" aria-labelledby="tracks-heading">
			<div class="block-head">
				<div class="block-head-row">
					<div>
						<p class="eyebrow">01</p>
						<h2 id="tracks-heading">Tracks</h2>
						<p>
							{data.tracks.length}
							{data.tracks.length === 1 ? 'track' : 'tracks'} in your library.
						</p>
					</div>
					<a class="pressable" href="/library/new">Upload track</a>
				</div>
			</div>

			{#if data.tracks.length === 0}
				<div class="empty" aria-live="polite">
					<p>No tracks yet. Upload your first one to get started.</p>
					<a class="pressable" href="/library/new">Upload track</a>
				</div>
			{:else}
				<ul class="track-list">
					{#each data.tracks as track (track.id)}
						<li>
							<TrackCard
								{track}
								signedIn={true}
								viewerName={data.user.name}
								ondeleted={() => invalidateAll()}
							/>
						</li>
					{/each}
				</ul>
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
		width: min(100%, var(--site-content-max));
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

	.block {
		margin-top: clamp(2.75rem, 7vw, 4rem);
		padding-top: clamp(1.75rem, 4vw, 2.25rem);
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		animation: rise 0.8s ease both;
	}

	.block-head-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem 1.5rem;
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
