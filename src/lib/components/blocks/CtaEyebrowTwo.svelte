<script>
	/**
	 * @type {{
	 *   eyebrow?: string,
	 *   heading?: string,
	 *   primaryLabel?: string,
	 *   primaryHref?: string,
	 *   secondaryLabel?: string,
	 *   secondaryHref?: string
	 * }}
	 */
	let {
		eyebrow = 'New',
		heading = 'Bring your own storage when you are ready',
		primaryLabel = 'Storage settings',
		primaryHref = '/',
		secondaryLabel = 'Learn more',
		secondaryHref = '/'
	} = $props();
</script>

<section class="cta">
	<div>
		<p class="eyebrow eyebrow-chip">{eyebrow}</p>
		<h2>{heading}</h2>
	</div>
	<div class="actions">
		<a class="ghost" href={secondaryHref}>{secondaryLabel}</a>
		<a class="ghost" href={primaryHref}>{primaryLabel}</a>
	</div>
</section>

<style>
	.cta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.5rem 0;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.25rem, 2.2vw, 1.6rem);
		font-weight: 500;
		max-width: 28ch;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	a {
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--ink);
		text-decoration: none;
		font-size: 0.88rem;
	}
</style>
