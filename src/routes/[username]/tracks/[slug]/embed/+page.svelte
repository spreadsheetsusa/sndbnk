<script>
	import { page } from '$app/state';
	import EmbedPlayer from '#lib/components/player/EmbedPlayer.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { trackShareMeta } from '#lib/share.js';

	let { data } = $props();

	const tenantSiteName = $derived(page.data.tenantSite?.name ?? null);
	const share = $derived(
		trackShareMeta({
			origin: data.siteOrigin,
			siteName: tenantSiteName,
			onTenant: Boolean(page.data.tenantSite),
			track: data.track,
			description: data.description,
			streamMime: data.streamMime,
			coverMime: data.coverMime,
			accent: page.data.tenantSite?.accentColor,
			noindex: true
		})
	);
	const artistHref = $derived(
		page.data.tenantSite ? `${data.siteOrigin}/` : `${data.siteOrigin}/users/${data.track.username}`
	);
	const autoplay = $derived(page.url.searchParams.get('autoplay') === '1');
</script>

<SeoHead
	title={share.title}
	description={share.description}
	canonical={share.canonical}
	origin={data.siteOrigin}
	image={share.image}
	imageType={share.imageType}
	siteName={share.siteName}
	type="music.song"
	jsonLd={share.jsonLd}
	noindex={share.noindex}
	oembedUrl={share.oembedUrl}
	publishedAt={share.publishedAt}
	audio={share.audio}
	discordEmbed={share.discordEmbed}
/>

<main id="main">
	<EmbedPlayer
		track={data.track}
		trackHref={share.canonical}
		{artistHref}
		brandHref={data.siteOrigin}
		brandLabel={tenantSiteName || 'SNDBNK'}
		showBrand={!page.data.tenantSite?.hideBranding}
		{autoplay}
	/>
</main>

<style>
	main {
		height: 100%;
	}
</style>
