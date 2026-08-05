<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';
	import Avatar from '#lib/components/Avatar.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import InlineMilkdrop from '#lib/components/player/InlineMilkdrop.svelte';
	import TrackCard from '#lib/components/player/TrackCard.svelte';
	import TrackInfoConsole from '#lib/components/player/TrackInfoConsole.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { visualizer } from '#lib/player/visualizer.svelte.js';
	import { formatDuration } from '#lib/media/audio-metadata.js';
	import { relativeTime } from '#lib/relative-time.js';
	import { absoluteUrl, musicRecordingJsonLd } from '#lib/seo.js';

	let { data } = $props();

	/** @type {string | null} */
	let deletingCommentId = $state(null);

	const artistName = $derived(data.track.artist || data.track.uploaderName);
	const tenantSiteName = $derived(page.data.tenantSite?.name ?? null);
	const siteLabel = $derived(tenantSiteName || 'SNDBNK');
	const pageTitle = $derived(`${data.track.title} by ${artistName} | ${siteLabel}`);
	const pageDescription = $derived(
		data.description?.trim() || `Listen to ${data.track.title} by ${artistName} on ${siteLabel}.`
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
					mediaType: data.track.mediaType ?? 'track',
					durationMs: data.track.durationMs,
					bitrate: data.track.bitrate ?? null,
					sampleRate: data.track.sampleRate ?? null,
					channels: data.track.channels ?? null,
					codec: data.track.codec ?? null,
					hasCover: data.track.hasCover,
					waveform: data.track.waveform,
					likedByViewer: data.track.likedByViewer,
					playCount: data.track.playCount ?? 0
				},
				seconds
			);
		}
	}

	async function handleDeleted() {
		await goto(data.track.isOwner ? '/library' : '/');
	}

	/**
	 * @param {string} commentId
	 */
	async function deleteOwnComment(commentId) {
		if (deletingCommentId) return;
		if (!confirm('Delete this comment? This cannot be undone.')) return;

		deletingCommentId = commentId;
		try {
			const res = await fetch(`/api/tracks/${data.track.id}/comments/${commentId}`, {
				method: 'DELETE'
			});
			if (res.ok) await invalidateAll();
		} finally {
			deletingCommentId = null;
		}
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

	<main id="main">
		<div class="player-wrap">
			{#if visualizer.showInline}
				<InlineMilkdrop variant="deck" />
			{/if}
			<TrackCard
				track={data.track}
				signedIn={Boolean(data.viewer)}
				viewerName={data.viewer?.name ?? null}
				viewerImage={data.viewer?.image ?? null}
				titleAsHeading
				oncommented={() => invalidateAll()}
				ondeleted={handleDeleted}
			/>
		</div>

		{#if data.description}
			<section class="description" aria-label="Description">
				<p>{data.description}</p>
			</section>
		{/if}

		<div class="below-player">
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
							<li id="comment-{comment.id}">
								<Avatar src={comment.userImage} name={comment.userName} />
								<div class="comment-body">
									<div class="comment-head">
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
										{#if data.viewer?.id === comment.userId}
											<button
												type="button"
												class="comment-delete"
												title="Delete comment"
												aria-label="Delete comment"
												disabled={deletingCommentId === comment.id}
												onclick={() => deleteOwnComment(comment.id)}
											>
												<IconTrash size={14} stroke={1.75} aria-hidden="true" />
											</button>
										{/if}
									</div>
									<p class="comment-text">{comment.body}</p>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<div class="info-rail">
				<TrackInfoConsole
					trackId={data.track.id}
					hasCover={data.track.hasCover}
					mediaType={data.track.mediaType}
					genre={data.track.genre}
					album={data.meta.album}
					year={data.meta.year}
					trackNumber={data.meta.trackNumber}
					bpm={data.meta.bpm}
					isrc={data.meta.isrc}
					durationMs={data.track.durationMs}
					bitrate={data.track.bitrate}
					sampleRate={data.track.sampleRate}
					channels={data.track.channels}
					codec={data.track.codec}
					playCount={data.track.playCount}
					likeCount={data.track.likeCount}
					commentCount={data.track.commentCount}
					createdAt={data.track.createdAt}
				/>
			</div>
		</div>
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
		width: min(100%, var(--site-content-max-wide));
		margin: 0 auto;
		padding-top: clamp(1.25rem, 4vw, 2.5rem);
	}

	.player-wrap {
		display: grid;
		gap: 1rem;
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

	.below-player {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: clamp(1.5rem, 4vw, 2.5rem);
		align-items: start;
		margin-top: clamp(2rem, 5vw, 3rem);
		padding-top: 1.5rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	@media (min-width: 961px) {
		.below-player {
			grid-template-columns: minmax(0, 1fr) var(--site-sidebar-width);
		}

		.info-rail {
			position: sticky;
			top: calc(var(--site-header-height) + 1rem);
		}
	}

	.comments {
		min-width: 0;
		animation: rise 0.8s ease 0.1s both;
	}

	.info-rail {
		min-width: 0;
		animation: rise 0.85s ease 0.14s both;
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
		scroll-margin-top: calc(var(--site-header-height) + 1rem);
		--avatar-bg: color-mix(in srgb, var(--ink) 10%, transparent);
		--avatar-color: var(--ink);
	}

	.comment-body {
		flex: 1;
		min-width: 0;
	}

	.comment-head {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		justify-content: space-between;
		margin: 0 0 0.2rem;
	}

	.comment-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: baseline;
		margin: 0;
		min-width: 0;
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

	.comment-delete {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: var(--tap-min);
		height: var(--tap-min);
		margin: -0.35rem -0.35rem 0 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}

	.comment-delete:hover:not(:disabled),
	.comment-delete:focus-visible {
		color: var(--ink);
	}

	.comment-delete:disabled {
		opacity: 0.45;
		cursor: wait;
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
