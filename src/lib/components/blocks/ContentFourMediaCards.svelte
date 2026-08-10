<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   heading?: string,
	 *   body?: string,
	 *   cards?: Array<{ title: string, body: string, imageLabel: string }>
	 * }}
	 */
	let {
		heading = 'What you can ship',
		body = 'Four surfaces for the catalog — each with room for cover art and a short hook.',
		cards = [
			{ title: 'Singles', body: 'Lead with the artwork.', imageLabel: 'Single' },
			{ title: 'Mixes', body: 'Long sets, clear titles.', imageLabel: 'Mix' },
			{ title: 'Packs', body: 'Loops ready to drop.', imageLabel: 'Pack' },
			{ title: 'Shows', body: 'Episodes listeners find.', imageLabel: 'Show' }
		]
	} = $props();
</script>

<section class="content">
	<header>
		<h2>{heading}</h2>
		<p>{body}</p>
	</header>
	<div class="grid">
		{#each cards as card (card.title)}
			<article>
				<MediaPlaceholder label={card.imageLabel} ratio="5 / 4" />
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
		padding: 2rem 0;
	}

	header {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		align-items: start;
	}

	@media (max-width: 720px) {
		header {
			grid-template-columns: 1fr;
		}
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.35rem, 2.4vw, 1.75rem);
		font-weight: 500;
	}

	header p {
		margin: 0;
		color: var(--muted);
		line-height: 1.45;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.85rem;
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	article {
		display: grid;
		gap: 0.4rem;
		align-content: start;
	}

	h3 {
		margin: 0.15rem 0 0;
		font-size: 1rem;
		font-weight: 500;
	}

	article p {
		margin: 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.4;
	}
</style>
