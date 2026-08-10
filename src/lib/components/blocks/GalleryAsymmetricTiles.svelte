<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   heading?: string,
	 *   tiles?: Array<{ imageLabel: string, caption: string }>
	 * }}
	 */
	let {
		heading = 'From the archive',
		tiles = [
			{ imageLabel: 'Studio', caption: 'Tracking vocals at night.' },
			{ imageLabel: 'Deck', caption: 'First listen on vinyl.' },
			{ imageLabel: 'Crowd', caption: 'Main stage, hour three.' },
			{ imageLabel: 'Gear', caption: 'Modular patch for the bridge.' },
			{ imageLabel: 'Cover', caption: 'Final artwork proof.' }
		]
	} = $props();
</script>

<section class="content">
	<header>
		<h2>{heading}</h2>
	</header>
	<div class="grid">
		{#each tiles as tile, index (tile.imageLabel + index)}
			<figure class="tile tile-{index + 1}">
				<MediaPlaceholder label={tile.imageLabel} ratio="4 / 3" />
				<figcaption>{tile.caption}</figcaption>
			</figure>
		{/each}
	</div>
</section>

<style>
	.content {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) 2fr;
		gap: 1.25rem;
		align-items: start;
		padding: 2rem 0;
	}

	@media (max-width: 800px) {
		.content {
			grid-template-columns: 1fr;
		}
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.35rem, 2.4vw, 1.75rem);
		font-weight: 500;
		max-width: 14ch;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		grid-auto-rows: minmax(5.5rem, auto);
		gap: 0.65rem;
	}

	@media (max-width: 640px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.tile-1,
		.tile-4,
		.tile-5 {
			grid-column: span 2;
		}

		.tile-3 {
			grid-row: auto;
		}
	}

	.tile {
		margin: 0;
		display: grid;
		gap: 0.35rem;
		align-content: start;
	}

	.tile-1 {
		grid-column: span 2;
	}

	.tile-3 {
		grid-column: 4;
		grid-row: span 2;
	}

	.tile-4 {
		grid-column: span 2;
	}

	.tile-5 {
		grid-column: span 2;
	}

	figcaption {
		font-size: 0.78rem;
		color: var(--muted);
		line-height: 1.35;
	}
</style>
