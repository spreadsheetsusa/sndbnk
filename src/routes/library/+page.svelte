<script>
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { formatDuration } from '#lib/media/audio-metadata.js';

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
							<a class="track-row" href="/library/{track.id}">
								<div class="cover">
									{#if track.hasCover}
										<img
											src="/api/media/{track.id}/cover"
											alt=""
											width="72"
											height="72"
											loading="lazy"
										/>
									{:else}
										<span class="cover-placeholder" aria-hidden="true"></span>
									{/if}
								</div>
								<div class="track-meta">
									<span class="track-title">{track.title}</span>
									<span class="track-artist">{track.artist || 'Unknown artist'}</span>
									{#if track.album}
										<span class="track-album">{track.album}</span>
									{/if}
								</div>
								<div class="track-aside">
									{#if track.durationMs != null}
										<span class="track-duration">{formatDuration(track.durationMs)}</span>
									{/if}
									<span class="adapter-badge">{track.storageAdapter}</span>
								</div>
							</a>
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
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
	}

	.track-list li {
		border-top: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
	}

	.track-list li:last-child {
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
	}

	.track-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 1rem;
		align-items: center;
		padding: 0.85rem 0;
		color: var(--ink);
		text-decoration: none;
	}

	.track-aside {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.35rem;
	}

	.track-duration {
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
	}

	.track-row:hover .track-title {
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.cover {
		width: 4.5rem;
		height: 4.5rem;
		flex-shrink: 0;
	}

	.cover img,
	.cover-placeholder {
		display: block;
		width: 100%;
		height: 100%;
		border: 1px solid var(--ink);
		object-fit: cover;
	}

	.cover-placeholder {
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			linear-gradient(225deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			var(--paper);
		background-size: 12px 12px;
	}

	.track-meta {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.track-title {
		font-weight: 800;
		font-size: 0.95rem;
		line-height: 1.3;
	}

	.track-artist {
		color: var(--muted);
		font-size: 0.85rem;
		line-height: 1.35;
	}

	.track-album {
		color: var(--muted);
		font-size: 0.75rem;
		line-height: 1.35;
	}

	.adapter-badge {
		padding: 0.15rem 0.45rem;
		border: 1px solid var(--ink);
		background: rgb(200 255 61 / 22%);
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
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

	@media (max-width: 720px) {
		.track-row {
			grid-template-columns: auto 1fr;
		}

		.track-aside {
			grid-column: 2;
			flex-direction: row;
			align-items: center;
			justify-self: start;
		}
	}
</style>
