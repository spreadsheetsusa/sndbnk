<script>
	import AppearanceToggle from '#lib/components/blocks/AppearanceToggle.svelte';

	/**
	 * @type {{
	 *   logoText?: string,
	 *   links?: Array<{ label: string, href: string }>,
	 *   ctaLabel?: string,
	 *   ctaHref?: string,
	 *   showAppearanceToggle?: boolean,
	 *   resolvedAppearance?: 'light' | 'dark',
	 *   onAppearanceToggle?: () => void
	 * }}
	 */
	let {
		logoText = 'SNDBNK',
		links = [
			{ label: 'Home', href: '/' },
			{ label: 'Music', href: '/' },
			{ label: 'Events', href: '/' },
			{ label: 'Press', href: '/' }
		],
		ctaLabel = 'Book',
		ctaHref = '/',
		showAppearanceToggle = false,
		resolvedAppearance = 'light',
		onAppearanceToggle
	} = $props();
</script>

<header class="block-header">
	<a class="logo" href="/">{logoText}</a>
	<nav aria-label="Primary">
		{#each links as link (link.label)}
			<a href={link.href}>{link.label}</a>
		{/each}
	</nav>
	<div class="end">
		{#if showAppearanceToggle}
			<AppearanceToggle {resolvedAppearance} {onAppearanceToggle} />
		{/if}
		<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
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

	.logo {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--theme-4, var(--ink));
		text-decoration: none;
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
</style>
