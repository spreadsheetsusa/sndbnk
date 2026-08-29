<script>
	import ProfileCatalog from '#lib/components/profile/ProfileCatalog.svelte';

	/**
	 * @type {{
	 *   showHero?: boolean,
	 *   showTabs?: boolean,
	 *   showSidebar?: boolean,
	 *   profileData?: Record<string, any> | null,
	 *   profileList?: import('#lib/lists/track-list.svelte.js').TrackList | null
	 * }}
	 */
	let {
		showHero = true,
		showTabs = true,
		showSidebar = true,
		profileData = null,
		profileList = null
	} = $props();
</script>

{#if profileData && profileList}
	<ProfileCatalog
		data={profileData}
		list={profileList}
		{showHero}
		{showTabs}
		{showSidebar}
		sameHostResources
	/>
{:else}
	<section class="catalog-placeholder" aria-label="Profile catalog">
		<p class="eyebrow">Music</p>
		<h2>Profile catalog</h2>
		<p>Tracks, playlists, and profile details appear here when profile data is available.</p>
	</section>
{/if}

<style>
	.catalog-placeholder {
		display: grid;
		gap: 0.45rem;
		padding: clamp(1.5rem, 4vw, 3rem) 0;
		border-block: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.catalog-placeholder p,
	.catalog-placeholder h2 {
		margin: 0;
	}

	.catalog-placeholder h2 {
		font-family: var(--font-editorial);
		font-size: clamp(1.5rem, 3vw, 2.25rem);
		font-weight: 500;
	}

	.catalog-placeholder p:last-child {
		max-width: 34rem;
		color: var(--muted);
		line-height: 1.5;
	}
</style>
