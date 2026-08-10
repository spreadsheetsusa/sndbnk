<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   body?: string,
	 *   ctaLabel?: string,
	 *   ctaHref?: string,
	 *   listsHeading?: string,
	 *   lists?: Array<{ title: string, items: string }>
	 * }}
	 */
	let {
		heading = 'Built around the catalog',
		body = 'Lead with the story, then hand listeners clear paths into tracks, mixes, and shows.',
		ctaLabel = 'Browse the library',
		ctaHref = '/',
		listsHeading = 'Jump in',
		lists = [
			{ title: 'Listen', items: 'Feed\nCharts\nNew' },
			{ title: 'Create', items: 'Upload\nEdit\nPublish' },
			{ title: 'Share', items: 'Profile\nDomain\nEmbed' }
		]
	} = $props();
</script>

<section class="content">
	<div class="copy">
		<h2>{heading}</h2>
		<p>{body}</p>
		<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
	</div>
	<div class="lists">
		<h3>{listsHeading}</h3>
		<div class="cols">
			{#each lists as list (list.title)}
				<div>
					<h4>{list.title}</h4>
					<ul>
						{#each list.items.split('\n').filter(Boolean) as item (item)}
							<li><a href="/">{item}</a></li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		padding: 2rem 0;
	}

	@media (max-width: 800px) {
		.content {
			grid-template-columns: 1fr;
		}
	}

	.copy {
		display: grid;
		gap: 0.85rem;
		align-content: start;
		justify-items: start;
		padding-right: 1.25rem;
		border-right: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	@media (max-width: 800px) {
		.copy {
			padding-right: 0;
			padding-bottom: 1rem;
			border-right: 0;
			border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		}
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.35rem, 2.4vw, 1.75rem);
		font-weight: 500;
	}

	.copy p {
		margin: 0;
		color: var(--muted);
		line-height: 1.45;
	}

	.cta {
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.88rem;
	}

	.lists {
		display: grid;
		gap: 0.85rem;
		align-content: start;
	}

	h3 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: 1.15rem;
		font-weight: 500;
	}

	.cols {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.85rem;
	}

	h4 {
		margin: 0 0 0.4rem;
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.28rem;
	}

	a {
		color: var(--ink);
		text-decoration: none;
		font-size: 0.9rem;
	}
</style>
