<script>
	import ProfileCatalog from '#lib/components/profile/ProfileCatalog.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';

	/**
	 * @type {{
	 *   data: Record<string, any> & {
	 *     profile: { name: string },
	 *     site?: { name?: string | null, logoUrl?: string | null, hideBranding?: boolean } | null,
	 *     viaTenantHost: boolean,
	 *     siteOrigin: string
	 *   },
	 *   list: import('#lib/lists/track-list.svelte.js').TrackList
	 * }}
	 */
	let { data, list } = $props();

	const siteName = $derived(data.site?.name?.trim() || data.profile.name);
	const showPoweredBy = $derived(data.viaTenantHost && !data.site?.hideBranding);
</script>

<div class="profile-page" class:tenant-host={data.viaTenantHost}>
	{#if data.viaTenantHost}
		<header class="tenant-chrome">
			<a class="tenant-brand" href="/">
				{#if data.site?.logoUrl}
					<img class="tenant-logo" src={data.site.logoUrl} alt="" />
				{/if}
				<span class="tenant-name display-face">{siteName}</span>
			</a>
		</header>
	{:else}
		<SiteHeader />
	{/if}

	<main id="main">
		<ProfileCatalog {data} {list} />
	</main>

	{#if !data.viaTenantHost}
		<SiteFooter bordered />
	{:else if showPoweredBy}
		<footer class="tenant-footer">
			<a href={data.siteOrigin} rel="noopener">Powered by SNDBNK</a>
		</footer>
	{/if}
</div>

<style>
	.profile-page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) clamp(1.25rem, 4vw, 2.5rem);
	}

	.profile-page.tenant-host {
		display: grid;
		align-content: start;
	}

	.tenant-chrome {
		display: flex;
		align-items: center;
		padding: 0.85rem 0 0.5rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
	}

	.tenant-brand {
		display: inline-flex;
		gap: 0.65rem;
		align-items: center;
		min-width: 0;
		color: inherit;
		text-decoration: none;
	}

	.tenant-logo {
		width: 2rem;
		height: 2rem;
		object-fit: cover;
		border: 1px solid var(--ink);
	}

	.tenant-name {
		overflow: hidden;
		font-size: 1.15rem;
		letter-spacing: -0.02em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	main {
		width: 100%;
		padding-top: clamp(0.75rem, 2vw, 1.25rem);
	}

	.profile-page.tenant-host main {
		padding-top: 1.5rem;
	}

	.tenant-footer {
		padding: 1.25rem 0 0.25rem;
		text-align: center;
	}

	.tenant-footer a {
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.tenant-footer a:hover {
		color: var(--ink);
	}

	@media (max-width: 640px) {
		main {
			padding-top: 0.5rem;
		}
	}
</style>
