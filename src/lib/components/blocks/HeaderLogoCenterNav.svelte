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
			{ label: 'Home', href: '/' },
			{ label: 'Music', href: '/' },
			{ label: 'Events', href: '/' },
			{ label: 'Press', href: '/' }
		],
		ctaLabel = 'Book',
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
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 1.25rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}

	.logo {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--ink);
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

	.cta {
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.85rem;
	}
</style>
