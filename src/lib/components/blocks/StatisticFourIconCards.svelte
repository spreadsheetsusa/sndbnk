<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   stats?: Array<{ value: string, label: string }>,
	 *   ctaLabel?: string,
	 *   ctaHref?: string
	 * }}
	 */
	let {
		heading = 'Proof in the waveform',
		stats = [
			{ value: '3.2M', label: 'Counted plays' },
			{ value: '840', label: 'Creators live' },
			{ value: '12K', label: 'Tracks online' },
			{ value: '48', label: 'Countries' }
		],
		ctaLabel = 'Join the feed',
		ctaHref = '/'
	} = $props();
</script>

<section class="content">
	<h2>{heading}</h2>
	<div class="grid">
		{#each stats as stat (stat.label)}
			<article>
				<span class="icon" aria-hidden="true"></span>
				<p class="value">{stat.value}</p>
				<p class="label">{stat.label}</p>
			</article>
		{/each}
	</div>
	<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
</section>

<style>
	.content {
		display: grid;
		gap: 1.25rem;
		justify-items: center;
		padding: 2rem 0;
		text-align: center;
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.35rem, 2.4vw, 1.75rem);
		font-weight: 500;
		max-width: 28ch;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1rem;
		width: 100%;
	}

	@media (max-width: 800px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	article {
		display: grid;
		gap: 0.3rem;
		justify-items: center;
		padding: 0.85rem;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.icon {
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
	}

	.value {
		margin: 0.15rem 0 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.35rem, 2.5vw, 1.75rem);
		font-weight: 500;
		line-height: 1.1;
	}

	.label {
		margin: 0;
		color: var(--muted);
		font-size: 0.82rem;
	}

	.cta {
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.88rem;
	}
</style>
