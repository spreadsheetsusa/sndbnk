<script>
	import AppearanceToggle from '#lib/components/blocks/AppearanceToggle.svelte';
	import { showNavCta } from '#lib/components/blocks/nav-chrome.js';
	import SiteNavPlayer from '#lib/components/blocks/SiteNavPlayer.svelte';
	import { player } from '#lib/player/player.svelte.js';

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
			{ label: 'Home', href: '/' },
			{ label: 'Music', href: '/' },
			{ label: 'Events', href: '/' },
			{ label: 'Press', href: '/' }
		],
		showCta = true,
		ctaLabel = 'Book',
		ctaHref = '/',
		showAppearanceToggle = false,
		resolvedAppearance = 'light',
		onAppearanceToggle
	} = $props();

	const ctaOn = $derived(showNavCta(showCta, ctaLabel));
</script>

<header class="block-header" class:has-player={!!player.current}>
	<a class="logo" href="/">
		{#if logoUrl}
			<img src={logoUrl} alt="" />
		{:else}
			{logoText}
		{/if}
	</a>
	<SiteNavPlayer />
	<nav aria-label="Primary">
		{#each links as link (link.label)}
			<a href={link.href}>{link.label}</a>
		{/each}
	</nav>
	<div class="end">
		{#if showAppearanceToggle}
			<AppearanceToggle {resolvedAppearance} {onAppearanceToggle} />
		{/if}
		{#if ctaOn}
			<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
		{/if}
	</div>
</header>

<style>
	.block-header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 1.25rem;
		border-bottom: 1px solid color-mix(in srgb, var(--theme-2, var(--ink)) 40%, transparent);
		background: color-mix(in srgb, var(--theme-1, var(--paper)) 40%, var(--paper));
	}

	/* Player takes the flexible middle, same as the platform header. */
	.block-header.has-player {
		display: flex;
		flex-wrap: nowrap;
	}

	.block-header.has-player .logo,
	.block-header.has-player nav,
	.block-header.has-player .end {
		flex: 0 0 auto;
	}

	.logo {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--theme-4, var(--ink));
		text-decoration: none;
	}

	.logo img {
		display: block;
		height: 1.75rem;
		width: auto;
		max-width: 8rem;
		object-fit: contain;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1rem;
		font-size: 0.9rem;
	}

	nav a {
		color: var(--muted);
		text-decoration: none;
	}

	nav a:hover {
		color: var(--theme-2, var(--ink));
	}

	.end {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.cta {
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--theme-3, var(--ink));
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.85rem;
	}

	@media (max-width: 960px) {
		.block-header.has-player {
			flex-wrap: wrap;
		}
	}
</style>
