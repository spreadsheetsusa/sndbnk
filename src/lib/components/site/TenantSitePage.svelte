<script>
	import SeoHead from '#lib/components/SeoHead.svelte';
	import SitePageView from '#lib/components/site/SitePageView.svelte';
	import { webSiteJsonLd } from '#lib/seo.js';

	/** @typedef {import('#lib/components/blocks/types.js').PageBlockInstance} PageBlockInstance */

	/**
	 * @type {{
	 *   data: {
	 *     mode: 'tenant-site',
	 *     site: {
	 *       id: string,
	 *       name: string,
	 *       description?: string | null,
	 *       logoUrl?: string | null,
	 *       ogImageUrl?: string | null,
	 *       accentColor?: string | null,
	 *       appearance?: 'light' | 'dark' | 'user',
	 *       themePersona?: string,
	 *       themePalette?: import('#lib/builder/theme-persona.js').ThemeSlotColors | null,
	 *       hideBranding?: boolean,
	 *       header: PageBlockInstance | null,
	 *       footer: PageBlockInstance | null
	 *     },
	 *     page: {
	 *       id: string,
	 *       path: string,
	 *       title: string,
	 *       seoTitle?: string | null,
	 *       seoDescription?: string | null,
	 *       blocks: PageBlockInstance[]
	 *     },
	 *     catalog: Record<string, any> | null,
	 *     siteOrigin: string
	 *   },
	 *   profileList?: import('#lib/lists/track-list.svelte.js').TrackList | null
	 * }}
	 */
	let { data, profileList = null } = $props();

	const siteName = $derived(data.site.name.trim() || data.catalog?.profile?.name || 'Site');
	const title = $derived(
		data.page.seoTitle?.trim() || `${data.page.title.trim() || siteName} | ${siteName}`
	);
	const description = $derived(
		data.page.seoDescription?.trim() ||
			data.site.description?.trim() ||
			`${siteName} — music, releases, and more.`
	);
	const canonical = $derived(`${data.siteOrigin}${data.page.path}`);
	const image = $derived(data.site.ogImageUrl ?? data.site.logoUrl ?? null);
	const jsonLd = $derived(
		webSiteJsonLd({
			origin: data.siteOrigin,
			name: siteName,
			description,
			logo: data.site.logoUrl ?? null
		})
	);
</script>

<SeoHead
	{title}
	{description}
	{canonical}
	origin={data.siteOrigin}
	{image}
	{siteName}
	type="website"
	{jsonLd}
/>

<SitePageView site={data.site} page={data.page} profileData={data.catalog} {profileList} />
