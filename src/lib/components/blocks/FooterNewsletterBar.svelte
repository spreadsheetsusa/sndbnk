<script>
	/**
	 * @type {{
	 *   columns?: Array<{ title: string, links: string }>,
	 *   newsletterTitle?: string,
	 *   emailPlaceholder?: string,
	 *   submitLabel?: string,
	 *   copyright?: string,
	 *   meta?: string
	 * }}
	 */
	let {
		columns = [
			{ title: 'Listen', links: 'Feed\nCharts\nNew' },
			{ title: 'Create', links: 'Upload\nPlaylists\nSites' },
			{ title: 'Account', links: 'Settings\nBilling\nStorage' },
			{ title: 'Legal', links: 'Terms\nPrivacy\nCopyright' },
			{ title: 'Social', links: 'X\nInstagram\nYouTube' }
		],
		newsletterTitle = 'Get release notes',
		emailPlaceholder = 'you@example.com',
		submitLabel = 'Join',
		copyright = '© SNDBNK',
		meta = 'Made for artists & listeners'
	} = $props();
</script>

<footer class="footer">
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
		<label for="footer-news-email">{newsletterTitle}</label>
		<div class="row">
			<input id="footer-news-email" type="email" name="email" placeholder={emailPlaceholder} />
			<button type="submit" class="accent-fill">{submitLabel}</button>
		</div>
	</form>
	<div class="bar">
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

	.cols {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.85rem;
	}

	@media (max-width: 900px) {
		.cols {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
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
		max-width: 24rem;
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
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 0;
		border-top: 1px solid color-mix(in srgb, var(--theme-2, var(--ink)) 35%, transparent);
		background: color-mix(in srgb, var(--theme-1, var(--ink)) 10%, transparent);
		font-size: 0.8rem;
		color: var(--muted);
	}
</style>
