<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   imageLabel?: string,
	 *   title?: string,
	 *   body?: string,
	 *   price?: string,
	 *   ctaLabel?: string,
	 *   ctaHref?: string
	 * }}
	 */
	let {
		imageLabel = 'Product',
		title = 'Waveform tee',
		body = 'Soft cotton with a subtle waveform print — cut for studio sessions and late-night sets.',
		price = '$32',
		ctaLabel = 'Add to cart',
		ctaHref = '/'
	} = $props();
</script>

<section class="product">
	<div class="media">
		<MediaPlaceholder label={imageLabel} ratio="1 / 1" />
	</div>
	<div class="copy">
		<p class="eyebrow">Merch drop</p>
		<h2>{title}</h2>
		<p>{body}</p>
		<p class="price">{price}</p>
		<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
	</div>
</section>

<style>
	.product {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		align-items: center;
		padding: 2rem 0;
	}

	@media (max-width: 720px) {
		.product {
			grid-template-columns: 1fr;
		}
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	h2 {
		margin: 0 0 0.65rem;
		font-family: var(--font-editorial);
		font-size: clamp(1.4rem, 2.5vw, 1.85rem);
		font-weight: 500;
		line-height: 1.15;
	}

	.copy > p:not(.eyebrow):not(.price) {
		margin: 0 0 1rem;
		color: var(--muted);
		max-width: 36ch;
		line-height: 1.45;
	}

	.price {
		margin: 0 0 1rem;
		font-family: var(--font-editorial);
		font-size: 1.25rem;
		font-weight: 500;
	}

	.cta {
		padding: 0.55rem 0.9rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.9rem;
	}
</style>
