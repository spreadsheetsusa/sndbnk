<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   columns?: Array<{ title: string, items: string }>,
	 *   ctaLabel?: string,
	 *   ctaHref?: string
	 * }}
	 */
	let {
		heading = 'Built for the whole catalog',
		columns = [
			{ title: 'Tracks', items: 'Singles\nEPs\nAlbums' },
			{ title: 'Mixes', items: 'DJ sets\nRadio\nLive' },
			{ title: 'Samples', items: 'One-shots\nLoops\nKits' },
			{ title: 'Shows', items: 'Podcasts\nInterviews\nSeries' }
		],
		ctaLabel = 'See all media types',
		ctaHref = '/'
	} = $props();
</script>

<section class="content">
	<h2>{heading}</h2>
	<div class="cols">
		{#each columns as col (col.title)}
			<div class="col">
				<h3>{col.title}</h3>
				<ul>
					{#each col.items.split('\n').filter(Boolean) as item (item)}
						<li>{item}</li>
					{/each}
				</ul>
			</div>
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
	}

	.cols {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1rem;
		width: 100%;
		text-align: left;
	}

	@media (max-width: 800px) {
		.cols {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.col {
		padding-left: 0.75rem;
		border-left: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}

	h3 {
		margin: 0 0 0.45rem;
		font-size: 0.95rem;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.3rem;
		color: var(--muted);
		font-size: 0.88rem;
	}

	.cta {
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.88rem;
	}
</style>
