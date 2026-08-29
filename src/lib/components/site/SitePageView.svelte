<script>
	import { getBlockDefinition } from '#lib/components/blocks/registry.js';
	import TenantSiteChrome from '#lib/components/site/TenantSiteChrome.svelte';

	/** @typedef {import('#lib/components/blocks/types.js').PageBlockInstance} PageBlockInstance */

	/**
	 * @type {{
	 *   site: {
	 *     id: string,
	 *     name: string,
	 *     accentColor?: string | null,
	 *     appearance?: 'light' | 'dark' | 'user',
	 *     themePersona?: string,
	 *     themePalette?: import('#lib/builder/theme-persona.js').ThemeSlotColors | null,
	 *     hideBranding?: boolean,
	 *     siteOrigin?: string,
	 *     header: PageBlockInstance | null,
	 *     footer: PageBlockInstance | null
	 *   },
	 *   page: {
	 *     id: string,
	 *     title: string,
	 *     blocks: PageBlockInstance[]
	 *   },
	 *   profileData?: Record<string, any> | null,
	 *   profileList?: import('#lib/lists/track-list.svelte.js').TrackList | null,
	 *   platformOrigin?: string | null
	 * }}
	 */
	let { site, page, profileData = null, profileList = null, platformOrigin = null } = $props();

	/**
	 * @param {PageBlockInstance} block
	 */
	function maxWidth(block) {
		return typeof block.layout?.maxWidth === 'number' ? `${block.layout.maxWidth}px` : undefined;
	}
</script>

<TenantSiteChrome {site} platformOrigin={platformOrigin ?? undefined}>
	<main id="main" aria-label={page.title}>
		{#each page.blocks as instance (instance.id)}
			{@const def = getBlockDefinition(instance.type)}
			{@const Block = def?.component}
			{#if Block}
				<section class="page-block" style:max-width={maxWidth(instance)}>
					{#if instance.type === 'catalog.profile'}
						<Block {...instance.props} {profileData} {profileList} />
					{:else}
						<Block {...instance.props} />
					{/if}
				</section>
			{/if}
		{/each}
	</main>
</TenantSiteChrome>

<style>
	main {
		display: grid;
		align-content: start;
	}

	.page-block {
		width: 100%;
		margin-inline: auto;
	}
</style>
