<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   billingLabel?: string,
	 *   tiers?: Array<{
	 *     name: string,
	 *     price: string,
	 *     features: string,
	 *     ctaLabel: string,
	 *     ctaHref: string,
	 *     highlighted?: string
	 *   }>
	 * }}
	 */
	let {
		heading = 'Plans for every stage',
		billingLabel = 'Billed monthly',
		tiers = [
			{
				name: 'Free',
				price: '$0',
				features: '15 tracks\nWaveforms\nPublic profile',
				ctaLabel: 'Start free',
				ctaHref: '/plans',
				highlighted: ''
			},
			{
				name: 'Vault',
				price: '$9',
				features: 'Hosted storage\nSubdomain\nBYO storage',
				ctaLabel: 'Choose Vault',
				ctaHref: '/plans',
				highlighted: 'yes'
			},
			{
				name: 'Studio',
				price: '$19',
				features: 'Custom domain\nUnbranded site\nPriority support',
				ctaLabel: 'Choose Studio',
				ctaHref: '/plans',
				highlighted: ''
			},
			{
				name: 'Label',
				price: '$49',
				features: 'Team seats\nMerch blocks\nAdvanced analytics',
				ctaLabel: 'Choose Label',
				ctaHref: '/plans',
				highlighted: ''
			}
		]
	} = $props();

	/**
	 * @param {string | undefined} value
	 */
	const isHighlighted = (value) => value === 'yes' || value === 'true' || value === '1';
</script>

<section class="pricing">
	<header>
		<h2>{heading}</h2>
		<p class="billing">{billingLabel}</p>
	</header>
	<div class="grid">
		{#each tiers as tier (tier.name)}
			<article class:highlighted={isHighlighted(tier.highlighted)}>
				<h3>{tier.name}</h3>
				<p class="price">{tier.price}</p>
				<ul>
					{#each tier.features.split('\n').filter(Boolean) as feature (feature)}
						<li>{feature}</li>
					{/each}
				</ul>
				<a class="cta" class:accent-fill={isHighlighted(tier.highlighted)} href={tier.ctaHref}
					>{tier.ctaLabel}</a
				>
			</article>
		{/each}
	</div>
</section>

<style>
	.pricing {
		display: grid;
		gap: 1.25rem;
		justify-items: center;
		padding: 2rem 0;
		text-align: center;
	}

	header {
		display: grid;
		gap: 0.35rem;
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.35rem, 2.4vw, 1.75rem);
		font-weight: 500;
		max-width: 28ch;
	}

	.billing {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		width: 100%;
		text-align: left;
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 520px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	article {
		display: grid;
		gap: 0.5rem;
		align-content: start;
		padding: 0.85rem;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	article.highlighted {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 500;
	}

	.price {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: 1.35rem;
		font-weight: 500;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.3rem;
	}

	li {
		color: var(--muted);
		font-size: 0.85rem;
		line-height: 1.35;
		padding-left: 0.85rem;
		position: relative;
	}

	li::before {
		content: '•';
		position: absolute;
		left: 0;
		color: var(--accent);
	}

	.cta {
		margin-top: 0.35rem;
		padding: 0.45rem 0.7rem;
		border: 1px solid var(--ink);
		color: var(--ink);
		text-decoration: none;
		font-size: 0.85rem;
		text-align: center;
	}

	.cta.accent-fill {
		color: var(--on-accent);
	}
</style>
