<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   heading?: string,
	 *   images?: Array<{ imageLabel: string, caption: string }>
	 * }}
	 */
	let {
		heading = 'On the road',
		images = [
			{ imageLabel: 'Load-in', caption: 'Backline check before doors.' },
			{ imageLabel: 'FOH', caption: 'Mix position for the room.' },
			{ imageLabel: 'Crowd', caption: 'Peak hour from the balcony.' },
			{ imageLabel: 'Merch', caption: 'Table after the set.' },
			{ imageLabel: 'Bus', caption: 'Overnight to the next city.' },
			{ imageLabel: 'Sunrise', caption: 'Hotel lobby listen-back.' }
		]
	} = $props();
</script>

<section class="content">
	<header>
		<h2>{heading}</h2>
	</header>
	<div class="grid">
		{#each images as image (image.imageLabel)}
			<figure>
				<MediaPlaceholder label={image.imageLabel} ratio="4 / 3" />
				<figcaption>{image.caption}</figcaption>
			</figure>
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

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.35rem, 2.4vw, 1.75rem);
		font-weight: 500;
		max-width: 24ch;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.85rem;
		width: 100%;
		text-align: left;
	}

	@media (max-width: 800px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 480px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	figure {
		margin: 0;
		display: grid;
		gap: 0.35rem;
	}

	figcaption {
		font-size: 0.78rem;
		color: var(--muted);
		line-height: 1.35;
	}
</style>
