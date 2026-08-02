<script>
	import SeoHead from '#lib/components/SeoHead.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';

	/**
	 * @type {{
	 *   title: string,
	 *   description: string,
	 *   canonical: string,
	 *   origin: string,
	 *   heading: string,
	 *   children: import('svelte').Snippet
	 * }}
	 */
	let { title, description, canonical, origin, heading, children } = $props();
</script>

<SeoHead {title} {description} {canonical} {origin} />

<div class="page">
	<SiteHeader />

	<main>
		<header class="intro">
			<p class="eyebrow accent-text eyebrow-chip">Legal</p>
			<h1 class="display-face">{heading}</h1>
			<p class="meta">Effective date: August 2, 2026 · Operated by The American Spreadsheet Co.</p>
		</header>

		<article class="prose">
			{@render children()}
		</article>
	</main>

	<SiteFooter bordered />
</div>

<style>
	.page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) clamp(1.25rem, 4vw, 2.5rem);
	}

	.intro {
		display: grid;
		gap: 0.75rem;
		padding: clamp(1.5rem, 4vw, 2.5rem) 0 1.75rem;
		max-width: var(--site-content-max);
	}

	h1 {
		margin: 0;
		font-size: clamp(2.4rem, 6vw, 3.6rem);
		line-height: 0.95;
		letter-spacing: -0.03em;
	}

	.meta {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
		line-height: 1.45;
	}

	.prose {
		display: grid;
		gap: 1.35rem;
		max-width: var(--site-content-max);
		padding-bottom: 1rem;
		color: var(--ink);
		font-size: 0.98rem;
		line-height: 1.65;
	}

	.prose :global(h2) {
		margin: 0.85rem 0 0;
		font-size: 1.05rem;
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	.prose :global(p),
	.prose :global(ul) {
		margin: 0;
	}

	.prose :global(ul) {
		display: grid;
		gap: 0.4rem;
		padding-left: 1.2rem;
	}

	.prose :global(li::marker) {
		color: var(--muted);
	}

	.prose :global(a) {
		color: var(--ink);
		font-weight: 700;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.15em;
	}

	.prose :global(a:hover) {
		color: color-mix(in srgb, var(--accent) 55%, var(--ink));
	}

	.prose :global(strong) {
		font-weight: 800;
	}

	.prose :global(code) {
		padding: 0.05em 0.3em;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		background: color-mix(in srgb, var(--ink) 6%, var(--paper));
		font-size: 0.9em;
	}
</style>
