<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   body?: string,
	 *   primaryLabel?: string,
	 *   primaryHref?: string,
	 *   secondaryLabel?: string,
	 *   secondaryHref?: string,
	 *   tertiaryLabel?: string,
	 *   tertiaryHref?: string
	 * }}
	 */
	let {
		heading = 'Pick a next move',
		body = 'Whether you are shipping a single or standing up a label site, start here.',
		primaryLabel = 'Start free',
		primaryHref = '/',
		secondaryLabel = 'View plans',
		secondaryHref = '/',
		tertiaryLabel = 'Talk to us',
		tertiaryHref = '/'
	} = $props();
</script>

<section class="cta">
	<h2>{heading}</h2>
	<p>{body}</p>
	<div class="actions">
		<a class="ghost" href={tertiaryHref}>{tertiaryLabel}</a>
		<a class="ghost" href={secondaryHref}>{secondaryLabel}</a>
		<a class="primary accent-fill" href={primaryHref}>{primaryLabel}</a>
	</div>
</section>

<style>
	.cta {
		display: grid;
		gap: 0.75rem;
		justify-items: center;
		padding: 2rem 0;
		text-align: center;
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.4rem, 2.5vw, 1.85rem);
		font-weight: 500;
	}

	p {
		margin: 0;
		color: var(--muted);
		max-width: 42ch;
		line-height: 1.45;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}

	a {
		padding: 0.55rem 0.9rem;
		border: 1px solid var(--ink);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.ghost {
		color: var(--ink);
	}

	.primary {
		color: var(--on-accent);
	}
</style>
