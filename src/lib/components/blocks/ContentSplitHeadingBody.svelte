<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   body?: string,
	 *   ctaLabel?: string,
	 *   ctaHref?: string
	 * }}
	 */
	let {
		heading = 'Less chrome. More signal.',
		body = 'Keep the page focused on the music: clear headlines, short copy, and a single next step for listeners.',
		ctaLabel = 'Read the approach',
		ctaHref = '/'
	} = $props();
</script>

<section class="content">
	<h2>{heading}</h2>
	<div class="aside">
		<p>{body}</p>
		<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
	</div>
</section>

<style>
	.content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		align-items: start;
		padding: 2rem 0;
	}

	@media (max-width: 720px) {
		.content {
			grid-template-columns: 1fr;
		}
	}

	h2 {
		margin: 0;
		padding-right: 1rem;
		border-right: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		font-family: var(--font-editorial);
		font-size: clamp(1.5rem, 2.8vw, 2rem);
		font-weight: 500;
		line-height: 1.2;
	}

	@media (max-width: 720px) {
		h2 {
			border-right: 0;
			padding-right: 0;
			padding-bottom: 0.75rem;
			border-bottom: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		}
	}

	.aside {
		display: grid;
		gap: 0.9rem;
		justify-items: start;
	}

	p {
		margin: 0;
		color: var(--muted);
		line-height: 1.5;
	}

	.cta {
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.88rem;
	}
</style>
