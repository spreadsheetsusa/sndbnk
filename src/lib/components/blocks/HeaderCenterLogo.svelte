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
			{ label: 'Listen', href: '/' },
			{ label: 'Watch', href: '/' },
			{ label: 'Tour', href: '/' }
		],
		ctaLabel = 'Follow',
		ctaHref = '/',
		showAppearanceToggle = false,
		resolvedAppearance = 'light',
		onAppearanceToggle
	} = $props();
</script>

<header class="block-header">
	<nav class="left" aria-label="Primary">
		{#each links as link (link.label)}
			<a href={link.href}>{link.label}</a>
		{/each}
	</nav>
	<a class="logo" href="/">{logoText}</a>
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
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 1.25rem;
		border-bottom: 1px solid color-mix(in srgb, var(--theme-2, var(--ink)) 40%, transparent);
		background: color-mix(in srgb, var(--theme-5, var(--paper)) 50%, var(--paper));
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
</style>
