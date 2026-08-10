<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   title?: string,
	 *   body?: string,
	 *   swatches?: Array<{ label: string }>,
	 *   price?: string,
	 *   ctaLabel?: string,
	 *   ctaHref?: string,
	 *   imageLabel?: string
	 * }}
	 */
	let {
		title = 'Studio hoodie',
		body = 'Heavy fleece with an embroidered waveform — built for cold booths and long mix sessions.',
		swatches = [{ label: 'Charcoal' }, { label: 'Ink' }, { label: 'Olive' }],
		price = '$58',
		ctaLabel = 'Add to cart',
		ctaHref = '/',
		imageLabel = 'Hoodie'
	} = $props();

	const swatchMix = ['72%', '48%', '28%'];
</script>

<section class="product">
	<div class="copy">
		<p class="eyebrow">Merch drop</p>
		<h2>{title}</h2>
		<p>{body}</p>
		<div class="swatches" aria-label="Color options">
			{#each swatches as swatch, i (swatch.label)}
				<span
					class="swatch"
					style:--swatch-fill="color-mix(in srgb, var(--accent) {swatchMix[i % swatchMix.length]},
					var(--ink))"
					title={swatch.label}
				></span>
			{/each}
		</div>
		<p class="price">{price}</p>
		<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
	</div>
	<div class="media">
		<MediaPlaceholder label={imageLabel} ratio="1 / 1" />
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

		.media {
			order: -1;
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

	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}

	.swatch {
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		background: var(--swatch-fill);
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
