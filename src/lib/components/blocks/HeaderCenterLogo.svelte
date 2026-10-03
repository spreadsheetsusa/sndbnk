<script>
	import AppearanceToggle from '#lib/components/blocks/AppearanceToggle.svelte';
	import { showNavCta } from '#lib/components/blocks/nav-chrome.js';
	import SiteNavPlayer from '#lib/components/blocks/SiteNavPlayer.svelte';

	/**
	 * @type {{
	 *   logoText?: string,
	 *   logoUrl?: string,
	 *   links?: Array<{ label: string, href: string }>,
	 *   showCta?: boolean,
	 *   ctaLabel?: string,
	 *   ctaHref?: string,
	 *   showAppearanceToggle?: boolean,
	 *   resolvedAppearance?: 'light' | 'dark',
	 *   onAppearanceToggle?: () => void
	 * }}
	 */
	let {
		logoText = 'SNDBNK',
		logoUrl = '',
		links = [
			{ label: 'Listen', href: '/' },
			{ label: 'Watch', href: '/' },
			{ label: 'Tour', href: '/' }
		],
		showCta = true,
		ctaLabel = 'Follow',
		ctaHref = '/',
		showAppearanceToggle = false,
		resolvedAppearance = 'light',
		onAppearanceToggle
	} = $props();

	const ctaOn = $derived(showNavCta(showCta, ctaLabel));
</script>

<header class="block-header">
	<nav class="left" aria-label="Primary">
		{#each links as link (link.label)}
			<a href={link.href}>{link.label}</a>
		{/each}
	</nav>
	<a class="logo" href="/">
		{#if logoUrl}
			<img src={logoUrl} alt="" />
		{:else}
			{logoText}
		{/if}
	</a>
	<div class="end">
		{#if showAppearanceToggle}
			<AppearanceToggle {resolvedAppearance} {onAppearanceToggle} />
		{/if}
		{#if ctaOn}
			<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
		{/if}
	</div>
	<SiteNavPlayer />
</header>

<style>
	.block-header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.75rem 1rem;
		padding: 0.85rem 1.25rem;
		border-bottom: 1px solid color-mix(in srgb, var(--theme-2, var(--ink)) 40%, transparent);
		background: color-mix(in srgb, var(--theme-5, var(--paper)) 50%, var(--paper));
	}

	.block-header :global(.site-nav-player) {
		grid-column: 1 / -1;
	}

	.left {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
		font-size: 0.9rem;
	}

	.left a {
		color: var(--muted);
		text-decoration: none;
	}

	.left a:hover {
		color: var(--theme-2, var(--ink));
	}

	.logo {
		font-family: var(--font-display);
		font-size: 1.05rem;
		color: var(--theme-4, var(--ink));
		text-decoration: none;
		justify-self: center;
	}

	.logo img {
		display: block;
		height: 1.75rem;
		width: auto;
		max-width: 8rem;
		object-fit: contain;
	}

	.end {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.55rem;
		justify-self: end;
	}

	.cta {
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--theme-3, var(--ink));
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.85rem;
	}

	@media (max-width: 960px) {
		.block-header:has(:global(.header-player)) {
			display: flex;
			flex-wrap: wrap;
		}

		.block-header :global(.site-nav-player) {
			grid-column: auto;
		}
	}
</style>
