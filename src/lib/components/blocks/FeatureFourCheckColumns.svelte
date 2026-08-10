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
		heading = 'What you get out of the box',
		columns = [
			{ title: 'Upload', items: 'Drag-and-drop\nAsync waveforms\nTag write-back' },
			{ title: 'Publish', items: 'Draft mode\nGenre chips\nCover art' },
			{ title: 'Share', items: 'Public profiles\nCustom domains\nEmbed player' },
			{ title: 'Grow', items: 'Feed discovery\nPlay counts\nComments' }
		],
		ctaLabel = 'Compare plans',
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
						<li>
							<span class="check" aria-hidden="true"></span>
							{item}
						</li>
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

	@media (max-width: 480px) {
		.cols {
			grid-template-columns: 1fr;
		}
	}

	.col {
		padding-left: 0.75rem;
		border-left: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}

	h3 {
		margin: 0 0 0.45rem;
		font-size: 0.95rem;
		font-weight: 500;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.35rem;
	}

	li {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.45rem;
		align-items: start;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.35;
	}

	.check {
		width: 0.85rem;
		height: 0.85rem;
		margin-top: 0.12rem;
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
	}

	.cta {
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.88rem;
	}
</style>
