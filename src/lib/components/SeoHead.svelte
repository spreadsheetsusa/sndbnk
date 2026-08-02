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
	 *   jsonLd?: Record<string, unknown> | null,
	 *   noindex?: boolean
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
		jsonLd = null,
		noindex = false
	} = $props();

	const imagePath = $derived(image || DEFAULT_OG_IMAGE);
	const absoluteImage = $derived(absoluteUrl(origin, imagePath));
	const isDefaultImage = $derived(imagePath === DEFAULT_OG_IMAGE);
	const ogSiteName = $derived(siteName?.trim() || 'SNDBNK');
	const jsonLdText = $derived(jsonLd ? serializeJsonLd(jsonLd) : null);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	{#if noindex}
		<meta name="robots" content="noindex" />
	{/if}
	<link rel="canonical" href={canonical} />
	<meta property="og:site_name" content={ogSiteName} />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={absoluteImage} />
	{#if isDefaultImage}
		<meta property="og:image:width" content={DEFAULT_OG_IMAGE_WIDTH} />
		<meta property="og:image:height" content={DEFAULT_OG_IMAGE_HEIGHT} />
	{/if}
	<meta property="og:image:alt" content={title} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={absoluteImage} />
	{#if jsonLdText}
		{@html '<script type="application/ld+json">' + jsonLdText + '</script>'}
	{/if}
</svelte:head>
