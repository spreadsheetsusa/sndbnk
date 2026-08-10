<script>
	/**
	 * @type {{
	 *   eyebrow?: string,
	 *   heading?: string,
	 *   cards?: Array<{ title: string, body: string }>
	 * }}
	 */
	let {
		eyebrow = 'Platform',
		heading = 'Built for artists who ship audio',
		cards = [
			{ title: 'Library', body: 'File-manager flow with inline deck editing.' },
			{ title: 'Profiles', body: 'Public pages with tracks, likes, and reposts.' },
			{ title: 'Hosting', body: 'Subdomains, custom domains, and BYO storage.' }
		]
	} = $props();
</script>

<section class="content">
	<p class="eyebrow eyebrow-chip">{eyebrow}</p>
	<h2>{heading}</h2>
	<div class="grid">
		{#each cards as card (card.title)}
			<article>
				<span class="icon" aria-hidden="true"></span>
				<h3>{card.title}</h3>
				<p>{card.body}</p>
			</article>
		{/each}
	</div>
</section>

<style>
	.content {
		display: grid;
		gap: 1.25rem;
		justify-items: center;
		padding: 2rem 0;
		text-align: center;
	}

	.eyebrow {
		margin: 0;
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
		gap: 1rem;
		width: 100%;
		text-align: left;
	}

	@media (max-width: 800px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	article {
		display: grid;
		gap: 0.35rem;
		align-content: start;
		padding: 0.85rem;
		background: color-mix(in srgb, var(--accent) 12%, var(--paper));
		border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
	}

	.icon {
		width: 1.5rem;
		height: 1.5rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		background: color-mix(in srgb, var(--accent) 22%, var(--paper));
	}

	h3 {
		margin: 0.2rem 0 0;
		font-size: 1rem;
		font-weight: 500;
	}

	p {
		margin: 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.4;
	}
</style>
