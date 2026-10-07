<script>
	import {
		DEFAULT_OG_IMAGE,
		DEFAULT_OG_IMAGE_HEIGHT,
		DEFAULT_OG_IMAGE_WIDTH,
		absoluteUrl,
		serializeJsonLd
	} from '#lib/seo.js';

	/**
	 * @type {{
	 *   title: string,
	 *   description: string,
	 *   canonical: string,
	 *   origin: string,
	 *   image?: string | null,
	 *   siteName?: string | null,
	 *   type?: 'website' | 'profile' | 'music.song',
	 *   imageType?: string | null,
	 *   jsonLd?: Record<string, unknown> | null,
	 *   noindex?: boolean,
	 *   oembedUrl?: string | null,
	 *   publishedAt?: string | null,
	 *   audio?: {
	 *     url: string,
	 *     mime?: string | null,
	 *     durationSec?: number | null,
	 *     musicianUrl?: string | null
	 *   } | null,
	 *   discordEmbed?: Record<string, unknown> | null
	 * }}
	 */
	let {
		title,
		description,
		canonical,
		origin,
		image = null,
		siteName = null,
		type = 'website',
		imageType = null,
		jsonLd = null,
		noindex = false,
		oembedUrl = null,
		publishedAt = null,
		audio = null,
		discordEmbed = null
	} = $props();

	const imagePath = $derived(image || DEFAULT_OG_IMAGE);
	const absoluteImage = $derived(absoluteUrl(origin, imagePath));
	const isDefaultImage = $derived(imagePath === DEFAULT_OG_IMAGE);
	const ogSiteName = $derived(siteName?.trim() || 'SNDBNK');
	const jsonLdText = $derived(jsonLd ? serializeJsonLd(jsonLd) : null);
	const discordEmbedText = $derived(discordEmbed ? serializeJsonLd(discordEmbed) : null);
	const audioIsSecure = $derived(Boolean(audio?.url?.startsWith('https://')));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	{#if noindex}
		<meta name="robots" content="noindex" />
	{/if}
	<link rel="canonical" href={canonical} />
	{#if oembedUrl}
		<link rel="alternate" type="application/json+oembed" href={oembedUrl} {title} />
	{/if}
	<meta property="og:site_name" content={ogSiteName} />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	{#if publishedAt}
		<meta property="og:pubdate" content={publishedAt} />
	{/if}
	<meta property="og:image" content={absoluteImage} />
	{#if isDefaultImage}
		<meta property="og:image:width" content={DEFAULT_OG_IMAGE_WIDTH} />
		<meta property="og:image:height" content={DEFAULT_OG_IMAGE_HEIGHT} />
	{/if}
	{#if imageType}
		<meta property="og:image:type" content={imageType} />
	{/if}
	<meta property="og:image:alt" content={title} />
	{#if audio}
		<meta property="og:audio" content={audio.url} />
		{#if audioIsSecure}
			<meta property="og:audio:secure_url" content={audio.url} />
		{/if}
		{#if audio.mime}
			<meta property="og:audio:type" content={audio.mime} />
		{/if}
		{#if audio.durationSec != null}
			<meta property="music:duration" content={String(audio.durationSec)} />
		{/if}
		{#if audio.musicianUrl}
			<meta property="music:musician" content={audio.musicianUrl} />
		{/if}
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={absoluteImage} />
	{#if jsonLdText}
		{@html '<script type="application/ld+json">' + jsonLdText + '</script>'}
	{/if}
	{#if discordEmbedText}
		{@html '<script id="discord:component-embed" type="application/json">' +
			discordEmbedText +
			'</script>'}
	{/if}
</svelte:head>
