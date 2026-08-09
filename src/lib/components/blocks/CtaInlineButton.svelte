<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   subheading?: string,
	 *   ctaLabel?: string,
	 *   ctaHref?: string
	 * }}
	 */
	let {
		heading = 'Ready to put a page live?',
		subheading = 'Start with a root page and drop in blocks.',
		ctaLabel = 'Open builder',
		ctaHref = '/'
	} = $props();
</script>

<section class="cta">
	<div>
		<h2>{heading}</h2>
		<p>{subheading}</p>
	</div>
	<a class="accent-fill" href={ctaHref}>{ctaLabel}</a>
</section>

<style>
	.cta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.5rem 0;
		border-block: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	h2 {
		margin: 0 0 0.25rem;
		font-family: var(--font-editorial);
		font-size: 1.35rem;
		font-weight: 500;
	}

	p {
		margin: 0;
		color: var(--muted);
	}

	a {
		padding: 0.55rem 0.95rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.9rem;
	}
</style>
