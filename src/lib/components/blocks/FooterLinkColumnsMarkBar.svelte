<script>
	/**
	 * @type {{
	 *   markText?: string,
	 *   columns?: Array<{ title: string, links: string }>,
	 *   copyright?: string,
	 *   meta?: string
	 * }}
	 */
	let {
		markText = 'SNDBNK',
		columns = [
			{ title: 'Product', links: 'Feed\nLibrary\nPlans' },
			{ title: 'Creators', links: 'Upload\nSites\nDomains' },
			{ title: 'Company', links: 'About\nPrivacy\nTerms' },
			{ title: 'Help', links: 'Support\nStatus\nContact' }
		],
		copyright = '© SNDBNK',
		meta = 'Audio multi-tool'
	} = $props();
</script>

<footer class="footer">
	<div class="top">
		<div class="cols">
			{#each columns as col (col.title)}
				<div>
					<h3>{col.title}</h3>
					<ul>
						{#each col.links.split('\n').filter(Boolean) as item (item)}
							<li><a href="/">{item}</a></li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
		<span class="mark">{markText}</span>
	</div>
	<div class="bar">
		<span>{copyright}</span>
		<span>{meta}</span>
	</div>
</footer>

<style>
	.footer {
		display: grid;
		gap: 1rem;
		padding: 2rem 0 0;
	}

	.top {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1.25rem;
		align-items: start;
	}

	.mark {
		font-family: var(--font-display);
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	.cols {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1rem;
	}

	@media (max-width: 800px) {
		.top {
			grid-template-columns: 1fr;
		}

		.cols {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	h3 {
		margin: 0 0 0.45rem;
		font-size: 0.8rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.3rem;
	}

	a {
		color: var(--ink);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.bar {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		background: color-mix(in srgb, var(--ink) 4%, var(--paper));
		font-size: 0.8rem;
		color: var(--muted);
	}
</style>
