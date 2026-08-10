<script>
	/**
	 * @type {{
	 *   columns?: Array<{ title: string, links: string }>,
	 *   newsletterTitle?: string,
	 *   emailPlaceholder?: string,
	 *   submitLabel?: string,
	 *   logoText?: string,
	 *   copyright?: string,
	 *   meta?: string
	 * }}
	 */
	let {
		columns = [
			{ title: 'Listen', links: 'Feed\nCharts\nNew' },
			{ title: 'Create', links: 'Upload\nPlaylists\nSites' },
			{ title: 'Account', links: 'Settings\nBilling\nStorage' }
		],
		newsletterTitle = 'Stay in the loop',
		emailPlaceholder = 'you@example.com',
		submitLabel = 'Join',
		logoText = 'SNDBNK',
		copyright = '© SNDBNK',
		meta = 'Made for artists & listeners'
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
		<form class="news" onsubmit={(e) => e.preventDefault()}>
			<label for="footer-cols-news">{newsletterTitle}</label>
			<div class="row">
				<input id="footer-cols-news" type="email" name="email" placeholder={emailPlaceholder} />
				<button type="submit" class="accent-fill">{submitLabel}</button>
			</div>
		</form>
	</div>
	<div class="bar">
		<a class="logo" href="/">{logoText}</a>
		<span>{copyright}</span>
		<span>{meta}</span>
	</div>
</footer>

<style>
	.footer {
		display: grid;
		gap: 1.1rem;
		padding: 2rem 1.25rem 0;
		background: color-mix(in srgb, var(--theme-5, var(--paper)) 40%, var(--paper));
	}

	.top {
		display: grid;
		grid-template-columns: 1.4fr 1fr;
		gap: 1.25rem;
		align-items: start;
	}

	@media (max-width: 900px) {
		.top {
			grid-template-columns: 1fr;
		}
	}

	.cols {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.85rem;
	}

	h3 {
		margin: 0 0 0.4rem;
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--theme-2, var(--muted));
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
		font-size: 0.88rem;
	}

	.news {
		display: grid;
		gap: 0.4rem;
	}

	label {
		font-size: 0.85rem;
		color: var(--muted);
	}

	.row {
		display: flex;
		gap: 0.4rem;
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--field-border);
		border-radius: 0.125rem;
		background: var(--field-surface);
		color: var(--ink);
	}

	button {
		padding: 0.45rem 0.75rem;
		border: 1px solid var(--theme-3, var(--ink));
		color: var(--on-accent);
		cursor: pointer;
		font: inherit;
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.85rem 1.25rem;
		padding: 0.75rem 0;
		border-top: 1px solid color-mix(in srgb, var(--theme-2, var(--ink)) 35%, transparent);
		background: color-mix(in srgb, var(--theme-1, var(--ink)) 10%, transparent);
		font-size: 0.8rem;
		color: var(--muted);
	}

	.logo {
		font-family: var(--font-display);
		color: var(--theme-4, var(--ink));
	}
</style>
