<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import TrackCard from '#lib/components/player/TrackCard.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { formatDuration } from '#lib/media/audio-metadata.js';
	import { relativeTime } from '#lib/relative-time.js';
	import { absoluteUrl, musicRecordingJsonLd } from '#lib/seo.js';

	let { data } = $props();

	const artistName = $derived(data.track.artist || data.track.uploaderName);
	const tenantSiteName = $derived(page.data.tenantSite?.name ?? null);
	const siteLabel = $derived(tenantSiteName || 'SNDBNK');
	const pageTitle = $derived(`${data.track.title} by ${artistName} | ${siteLabel}`);
	const pageDescription = $derived(
		`Listen to ${data.track.title} by ${artistName} on ${siteLabel}.`
	);
	const seoCanonical = $derived(`${data.siteOrigin}/tracks/${data.track.id}`);
	const seoImage = $derived(data.track.hasCover ? `/api/media/${data.track.id}/cover` : null);
	const seoJsonLd = $derived(
		musicRecordingJsonLd({
			name: data.track.title,
			byArtist: artistName,
			url: seoCanonical,
			image: seoImage ? absoluteUrl(data.siteOrigin, seoImage) : null,
			durationMs: data.track.durationMs,
			description: data.description || pageDescription
		})
	);

	/**
	 * Jump playback to a comment's timestamp.
	 * @param {number} atMs
	 */
	function seekToComment(atMs) {
		const seconds = atMs / 1000;
		if (player.isCurrent(data.track.id)) {
			player.seek(seconds);
			player.resume();
		} else {
			player.play(
				{
					id: data.track.id,
					title: data.track.title,
					artist: data.track.artist,
					username: data.track.username,
					uploaderName: data.track.uploaderName,
					durationMs: data.track.durationMs,
					hasCover: data.track.hasCover,
					waveform: data.track.waveform,
					likedByViewer: data.track.likedByViewer
				},
				seconds
			);
		}
	}

	async function handleDeleted() {
		await goto(data.track.isOwner ? '/library' : '/');
	}
</script>

<SeoHead
	title={pageTitle}
	description={pageDescription}
	canonical={seoCanonical}
	origin={data.siteOrigin}
	image={seoImage}
	siteName={tenantSiteName}
	type="music.song"
	jsonLd={seoJsonLd}
/>

<div class="track-page">
	{#if !data.viaTenantHost}
		<SiteHeader />
	{/if}

	<main>
		<p class="eyebrow eyebrow-chip accent-text">Track</p>

		<div class="player-wrap">
			<TrackCard
				track={data.track}
				signedIn={Boolean(data.viewer)}
				viewerName={data.viewer?.name ?? null}
				viewerImage={data.viewer?.image ?? null}
				oncommented={() => invalidateAll()}
				ondeleted={handleDeleted}
			/>
		</div>

		{#if data.description}
			<section class="description" aria-label="Description">
				<p>{data.description}</p>
			</section>
		{/if}

		<section class="comments" aria-labelledby="comments-heading">
			<h2 id="comments-heading">
				{data.comments.length}
				{data.comments.length === 1 ? 'comment' : 'comments'}
			</h2>

			{#if data.comments.length === 0}
				<p class="comments-empty">
					No comments yet.
					{#if data.viewer}
						Be the first — drop one above while the track plays.
					{:else}
						<a href="/signin">Sign in</a> to leave one.
					{/if}
				</p>
			{:else}
				<ul class="comment-list">
					{#each data.comments as comment (comment.id)}
						<li>
							<Avatar src={comment.userImage} name={comment.userName} />
							<div class="comment-body">
								<p class="comment-meta">
									<span class="comment-author">{comment.userName}</span>
									{#if comment.atMs != null}
										<button
											type="button"
											class="comment-at"
											title="Play from this moment"
											onclick={() => seekToComment(comment.atMs ?? 0)}
										>
											at {formatDuration(comment.atMs)}
										</button>
									{/if}
									<span class="comment-when">{relativeTime(comment.createdAt)}</span>
								</p>
								<p class="comment-text">{comment.body}</p>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</main>
</div>

<style>
	.track-page {
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
		margin: 0 0 1rem;
	}

	.player-wrap {
		animation: rise 0.65s ease both;
	}

	@media (max-width: 640px) {
		.player-wrap {
			--track-card-cover-mobile: block;
			--track-card-wash: 0;
			--track-card-cover-size: 100%;
		}

		.player-wrap :global(.track-card) {
			padding: 0 0 1rem;
		}
	}

	@media (pointer: coarse) {
		.comment-at {
			display: inline-flex;
			align-items: center;
			min-height: var(--tap-min);
		}
	}

	.description {
		margin-top: 1.5rem;
		animation: rise 0.75s ease 0.05s both;
	}

	.description p {
		max-width: 44rem;
		margin: 0;
		color: var(--muted);
		line-height: 1.55;
		white-space: pre-line;
	}

	.comments {
		margin-top: clamp(2rem, 5vw, 3rem);
		padding-top: 1.5rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		animation: rise 0.8s ease 0.1s both;
	}

	.comments h2 {
		margin: 0 0 1rem;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: clamp(1.4rem, 3.5vw, 1.9rem);
		font-weight: 400;
		letter-spacing: -0.02em;
	}

	.comments-empty {
		margin: 0;
		color: var(--muted);
		line-height: 1.5;
	}

	.comments-empty a {
		color: var(--ink);
		font-weight: 700;
	}

	.comment-list {
		display: grid;
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.comment-list li {
		display: flex;
		gap: 0.65rem;
		align-items: flex-start;
		--avatar-bg: color-mix(in srgb, var(--ink) 10%, transparent);
		--avatar-color: var(--ink);
	}

	.comment-body {
		min-width: 0;
	}

	.comment-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: baseline;
		margin: 0 0 0.2rem;
	}

	.comment-author {
		font-size: 0.8rem;
		font-weight: 800;
	}

	.comment-at {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--accent);
		filter: contrast(1.2);
		font-size: 0.72rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		text-decoration: underline;
		text-underline-offset: 0.2rem;
		cursor: pointer;
	}

	.comment-when {
		color: var(--muted);
		font-size: 0.7rem;
	}

	.comment-text {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.5;
		overflow-wrap: anywhere;
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
