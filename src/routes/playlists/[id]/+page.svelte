<script>
	import PlaylistCard from '#lib/components/player/PlaylistCard.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { absoluteUrl } from '#lib/seo.js';
	import { page } from '$app/state';

	let { data } = $props();

	const origin = $derived(page.url.origin);
	const title = $derived(`${data.playlist.title} | SNDBNK`);
	const description = $derived(
		data.playlist.description?.trim() ||
			`Playlist by ${data.playlist.uploaderName} on SNDBNK — ${data.playlist.trackCount} tracks.`
	);
</script>

<SeoHead
	{title}
	{description}
	canonical={absoluteUrl(origin, `/playlists/${data.playlist.id}`)}
	{origin}
	type="website"
/>

<div class="page">
	<SiteHeader />

	<main>
		<header class="page-head">
			<p class="eyebrow eyebrow-chip accent-text">Playlist</p>
			{#if data.playlist.isOwner}
				<p class="owner-actions">
					<a href="/playlists/{data.playlist.id}/edit">Edit playlist</a>
				</p>
			{/if}
		</header>

		<PlaylistCard
			playlist={data.playlist}
			signedIn={Boolean(data.viewer)}
			viewerName={data.viewer?.name ?? null}
			viewerImage={data.viewer?.image ?? null}
		/>

		{#if data.playlist.description}
			<section class="description" aria-label="Description">
				<p>{data.playlist.description}</p>
			</section>
		{/if}
	</main>
</div>

<style>
	.page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 4rem;
	}

	main {
		width: min(100%, var(--site-content-max));
		margin: 0 auto;
		padding-top: clamp(0.75rem, 2vw, 1.25rem);
	}

	.page-head {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.25rem;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.owner-actions a {
		color: var(--ink);
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.description {
		margin-top: 1.25rem;
		max-width: 40rem;
		color: var(--muted);
		line-height: 1.55;
		white-space: pre-wrap;
	}

	.description p {
		margin: 0;
	}
</style>
