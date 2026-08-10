<script>
	/**
	 * @type {{
	 *   rows?: Array<{ title: string, body: string }>,
	 *   ctaLabel?: string,
	 *   ctaHref?: string
	 * }}
	 */
	let {
		rows = [
			{ title: 'Upload once', body: 'Drag audio into the library and metadata follows.' },
			{ title: 'Tune the page', body: 'Site builder blocks for hero, features, and footer.' },
			{ title: 'Go live', body: 'Publish to your profile, subdomain, or custom domain.' }
		],
		ctaLabel = 'Open the builder',
		ctaHref = '/'
	} = $props();
</script>

<section class="content">
	<div class="rows">
		{#each rows as row, i (row.title)}
			<article class:reverse={i % 2 === 1}>
				<span class="icon" aria-hidden="true"></span>
				<div>
					<h3>{row.title}</h3>
					<p>{row.body}</p>
				</div>
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
	}

	.rows {
		display: grid;
		gap: 1.25rem;
		width: 100%;
	}

	article {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1rem;
		align-items: center;
		padding: 0.85rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	article:last-child {
		border-bottom: 0;
	}

	article.reverse {
		grid-template-columns: 1fr auto;
	}

	article.reverse .icon {
		order: 2;
	}

	article.reverse div {
		order: 1;
		text-align: right;
	}

	@media (max-width: 640px) {
		article,
		article.reverse {
			grid-template-columns: auto 1fr;
		}

		article.reverse .icon {
			order: 0;
		}

		article.reverse div {
			order: 0;
			text-align: left;
		}
	}

	.icon {
		width: 2.25rem;
		height: 2.25rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
	}

	h3 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 500;
	}

	p {
		margin: 0.35rem 0 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.4;
	}

	.cta {
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.88rem;
	}
</style>
