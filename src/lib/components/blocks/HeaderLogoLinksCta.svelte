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
			{ label: 'Music', href: '/' },
			{ label: 'Shows', href: '/' },
			{ label: 'About', href: '/' },
			{ label: 'Contact', href: '/' }
		],
		ctaLabel = 'Listen',
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
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 1.25rem;
		border-bottom: 1px solid
			color-mix(in srgb, var(--theme-tertiary, var(--theme-2, var(--ink))) 40%, transparent);
		background: color-mix(
			in srgb,
			var(--theme-surface, var(--theme-5, var(--paper))) 55%,
			var(--paper)
		);
	}

	.logo {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--theme-primary, var(--accent));
		text-decoration: none;
		flex: 0 0 auto;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
		margin-left: auto;
		font-size: 0.9rem;
	}

	nav a {
		color: var(--muted);
		text-decoration: none;
	}

	nav a:hover {
		color: var(--theme-secondary, var(--theme-2, var(--ink)));
	}

	.end {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex: 0 0 auto;
	}

	.cta {
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--theme-success, var(--theme-3, var(--ink)));
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.85rem;
	}
</style>
