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
			{ label: 'Releases', href: '/' },
			{ label: 'Mixes', href: '/' },
			{ label: 'Store', href: '/' }
		],
		ctaLabel = 'Join',
		ctaHref = '/'
	} = $props();
</script>

<header class="block-header">
	<a class="logo" href="/">{logoText}</a>
	<span class="divider" aria-hidden="true"></span>
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
		gap: 0.85rem;
		padding: 0.85rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}

	.logo {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--ink);
		text-decoration: none;
	}

	.divider {
		width: 1px;
		align-self: stretch;
		background: color-mix(in srgb, var(--ink) 28%, transparent);
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
		font-size: 0.9rem;
	}

	nav a {
		color: var(--muted);
		text-decoration: none;
	}

	.cta {
		margin-left: auto;
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.85rem;
	}
</style>
