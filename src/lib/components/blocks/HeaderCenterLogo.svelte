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
			{ label: 'Listen', href: '/' },
			{ label: 'Watch', href: '/' },
			{ label: 'Tour', href: '/' }
		],
		ctaLabel = 'Follow',
		ctaHref = '/'
	} = $props();
</script>

<header class="block-header">
	<nav class="left" aria-label="Primary">
		{#each links as link (link.label)}
			<a href={link.href}>{link.label}</a>
		{/each}
	</nav>
	<a class="logo" href="/">{logoText}</a>
	<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
</header>

<style>
	.block-header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
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

	.logo {
		font-family: var(--font-display);
		font-size: 1.05rem;
		color: var(--ink);
		text-decoration: none;
		justify-self: center;
	}

	.cta {
		justify-self: end;
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.85rem;
	}
</style>
