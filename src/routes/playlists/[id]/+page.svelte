<script>
	import { page } from '$app/state';
	import PlaylistCard from '#lib/components/player/PlaylistCard.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import TenantSiteChrome from '#lib/components/site/TenantSiteChrome.svelte';
	import { absoluteUrl, musicPlaylistJsonLd } from '#lib/seo.js';

	let { data } = $props();

	const tenantSiteName = $derived(page.data.tenantSite?.name ?? null);
	const siteLabel = $derived(tenantSiteName || 'SNDBNK');
	const title = $derived(`${data.playlist.title} | ${siteLabel}`);
	const description = $derived(
		data.playlist.description?.trim() ||
			`Playlist by ${data.playlist.uploaderName} on ${siteLabel} — ${data.playlist.trackCount} tracks.`
	);
	const seoCanonical = $derived(`${data.siteOrigin}/playlists/${data.playlist.id}`);
	const seoImage = $derived.by(() => {
		if (data.playlist.coverUrl) return data.playlist.coverUrl;
		const covered = data.playlist.tracks.find((t) => t.hasCover);
		if (covered?.coverUrl) return covered.coverUrl;
		if (data.playlist.coverTrackId) return `/api/media/${data.playlist.coverTrackId}/cover`;
		return covered ? `/api/media/${covered.id}/cover` : null;
	});
	const seoJsonLd = $derived(
		musicPlaylistJsonLd({
			name: data.playlist.title,
			byArtist: data.playlist.uploaderName,
			url: seoCanonical,
			image: seoImage ? absoluteUrl(data.siteOrigin, seoImage) : null,
			description,
			numTracks: data.playlist.trackCount
		})
	);
</script>

<SeoHead
	{title}
	{description}
	canonical={seoCanonical}
	origin={data.siteOrigin}
	image={seoImage}
	siteName={tenantSiteName}
	type="website"
	jsonLd={seoJsonLd}
/>

{#snippet playlistContent()}
	<main id="main">
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
			viewerId={data.viewer?.id ?? null}
			viewerName={data.viewer?.name ?? null}
			viewerImage={data.viewer?.image ?? null}
			titleAsHeading
		/>

		{#if data.playlist.description}
			<section class="description" aria-label="Description">
				<p>{data.playlist.description}</p>
			</section>
		{/if}
	</main>
{/snippet}

{#if page.data.tenantSite}
	<TenantSiteChrome site={page.data.tenantSite}>
		<div class="page">
			{@render playlistContent()}
		</div>
	</TenantSiteChrome>
{:else}
	<div class="page">
		<SiteHeader />
		{@render playlistContent()}
	</div>
{/if}

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
