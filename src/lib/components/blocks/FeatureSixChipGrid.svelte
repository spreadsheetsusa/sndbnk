<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   chips?: Array<{ title: string }>,
	 *   ctaLabel?: string,
	 *   ctaHref?: string
	 * }}
	 */
	let {
		heading = 'Every format in one catalog',
		chips = [
			{ title: 'Singles' },
			{ title: 'EPs' },
			{ title: 'Albums' },
			{ title: 'DJ mixes' },
			{ title: 'Podcasts' },
			{ title: 'Sample packs' }
		],
		ctaLabel = 'Browse media types',
		ctaHref = '/'
	} = $props();
</script>

<section class="content">
	<h2>{heading}</h2>
	<div class="grid">
		{#each chips as chip (chip.title)}
			<span class="chip">{chip.title}</span>
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
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.55rem;
		width: 100%;
	}

	@media (max-width: 640px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.chip {
		padding: 0.45rem 0.65rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		background: color-mix(in srgb, var(--ink) 4%, var(--paper));
		font-size: 0.88rem;
		text-align: center;
	}

	.cta {
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.88rem;
	}
</style>
