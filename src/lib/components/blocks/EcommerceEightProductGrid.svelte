<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   products?: Array<{ title: string, meta: string, price: string, imageLabel: string }>
	 * }}
	 */
	let {
		products = [
			{ title: 'Waveform tee', meta: 'Unisex · Black', price: '$32', imageLabel: 'Tee' },
			{ title: 'Vault cap', meta: 'Embroidered logo', price: '$28', imageLabel: 'Cap' },
			{ title: 'Sample pack vol. 1', meta: '24 one-shots · WAV', price: '$18', imageLabel: 'Pack' },
			{ title: 'Studio mug', meta: '11oz ceramic', price: '$16', imageLabel: 'Mug' },
			{ title: 'SNDBNK tote', meta: 'Heavy canvas', price: '$24', imageLabel: 'Tote' },
			{ title: 'Club mix USB', meta: 'Limited run', price: '$20', imageLabel: 'USB' },
			{ title: 'Sticker sheet', meta: 'Die-cut set', price: '$8', imageLabel: 'Stickers' },
			{ title: 'Hoodie', meta: 'Fleece · Charcoal', price: '$58', imageLabel: 'Hoodie' }
		]
	} = $props();
</script>

<section class="shop">
	<div class="grid">
		{#each products as product (product.title)}
			<article>
				<MediaPlaceholder label={product.imageLabel} ratio="1 / 1" />
				<h3>{product.title}</h3>
				<p class="meta">{product.meta}</p>
				<p class="price">{product.price}</p>
			</article>
		{/each}
	</div>
</section>

<style>
	.shop {
		padding: 2rem 0;
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

	@media (max-width: 480px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	article {
		display: grid;
		gap: 0.35rem;
		align-content: start;
	}

	h3 {
		margin: 0.15rem 0 0;
		font-size: 0.95rem;
		font-weight: 500;
	}

	.meta {
		margin: 0;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.price {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: 0.95rem;
		font-weight: 500;
	}
</style>
