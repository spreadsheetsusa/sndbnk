<script>
	/**
	 * @type {{
	 *   logoText?: string,
	 *   links?: Array<{ label: string, href: string }>,
	 *   ctaLabel?: string,
	 *   ctaHref?: string
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
		ctaHref = '/'
	} = $props();
</script>

<header class="block-header">
	<a class="logo" href="/">{logoText}</a>
	<nav aria-label="Primary">
		{#each links as link (link.label)}
			<a href={link.href}>{link.label}</a>
		{/each}
	</nav>
	<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
</header>

<style>
	.block-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}

	.logo {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--ink);
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
		color: var(--ink);
	}

	.cta {
		flex: 0 0 auto;
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.85rem;
	}
</style>
