<script>
	/**
	 * @typedef {{
	 *   id: string,
	 *   label: string,
	 *   blurb: string,
	 *   features: string[],
	 *   monthlyAmount: number,
	 *   sortOrder: number
	 * }} ShowcasePlan
	 */

	/**
	 * @type {{
	 *   plans: ShowcasePlan[],
	 *   currentPlanId?: string | null,
	 *   signedIn?: boolean
	 * }}
	 */
	let { plans, currentPlanId = null, signedIn = false } = $props();

	const currentIndex = $derived(
		currentPlanId ? plans.findIndex((tier) => tier.id === currentPlanId) : -1
	);
	const hasHigherTier = $derived(
		currentIndex >= 0 ? currentIndex < plans.length - 1 : plans.length > 1
	);
	const visible = $derived(!signedIn || hasHigherTier);

	const eyebrow = $derived(signedIn ? 'Upgrade' : 'Plans');
	const title = $derived(signedIn ? 'More signal when you need it' : 'Pick your signal strength');
	const lede = $derived(
		signedIn
			? 'Keep Free forever, or step up for a subdomain, custom domain, and room to grow.'
			: 'Fully usable on Free — especially with your own storage. Vault adds a subdomain. Studio is the full-power tier.'
	);

	/**
	 * @param {number} cents
	 */
	function money(cents) {
		const dollars = cents / 100;
		return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
	}

	/**
	 * @param {ShowcasePlan} tier
	 * @param {number} index
	 */
	function ctaLabel(tier, index) {
		if (signedIn && currentIndex >= 0 && index === currentIndex) return 'Current plan';
		if (signedIn && currentIndex >= 0 && index > currentIndex) return `Upgrade to ${tier.label}`;
		if (tier.monthlyAmount === 0) return 'Start free';
		return `Choose ${tier.label}`;
	}

	/**
	 * @param {number} index
	 */
	function showCta(index) {
		if (!signedIn) return true;
		if (currentIndex < 0) return true;
		return index >= currentIndex;
	}

	/**
	 * @param {number} index
	 */
	function isUpgrade(index) {
		return signedIn && currentIndex >= 0 && index > currentIndex;
	}
</script>

{#if visible && plans.length}
	<section class="plans-showcase" aria-labelledby="plans-showcase-title">
		<header class="head">
			<div class="head-row">
				<p class="eyebrow">{eyebrow}</p>
				<span class="mark" aria-hidden="true">///</span>
			</div>
			<h2 id="plans-showcase-title">{title}</h2>
			<p class="lede">{lede}</p>
		</header>

		<div class="tiers" role="list">
			{#each plans as tier, i (tier.id)}
				{@const isCurrent = signedIn && currentPlanId === tier.id}
				{@const isFeatured = tier.id === 'studio'}
				<article
					class="tier"
					class:current={isCurrent}
					class:featured={isFeatured}
					style="--i: {i}"
					role="listitem"
				>
					{#if isCurrent}
						<p class="tier-badge">Current</p>
					{:else if isFeatured}
						<p class="tier-badge">Full power</p>
					{/if}

					<div class="tier-top">
						<h3 class="display-face">{tier.label}</h3>
						<p class="price">
							{#if tier.monthlyAmount === 0}
								<span class="amount">Free</span>
							{:else}
								<span class="amount">{money(tier.monthlyAmount)}</span>
								<span class="per">/mo</span>
							{/if}
						</p>
					</div>

					<p class="blurb">{tier.blurb}</p>

					<ul>
						{#each tier.features.slice(0, 4) as feature (feature)}
							<li>{feature}</li>
						{/each}
					</ul>

					{#if showCta(i)}
						<a
							class="cta pressable"
							class:ghost={isCurrent || tier.monthlyAmount === 0}
							class:upgrade={isUpgrade(i)}
							href="/plans?plan={tier.id}"
						>
							{ctaLabel(tier, i)}
						</a>
					{/if}
				</article>
			{/each}
		</div>
	</section>
{/if}

<style>
	.plans-showcase {
		display: grid;
		gap: clamp(2rem, 4vw, 3rem);
		width: 100%;
		padding: clamp(2.5rem, 5vw, 4.5rem) 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		animation: rise 0.85s ease both;
	}

	.head {
		display: grid;
		gap: 1rem;
	}

	.head-row {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 2rem;
	}

	.head > :not(.head-row) {
		max-width: 48rem;
		text-wrap: pretty;
	}

	.eyebrow {
		margin: 0.65rem 0 0;
	}

	.mark {
		padding: 0.45rem 0.7rem;
		color: var(--on-accent);
		background: var(--accent);
		font-weight: 900;
		letter-spacing: 0.15em;
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.85rem, 3.6vw, 3rem);
		font-weight: 700;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.lede {
		margin: 0;
		max-width: 46rem;
		color: color-mix(in srgb, var(--muted) 88%, var(--ink));
		font-size: clamp(1rem, 1.35vw, 1.125rem);
		line-height: 1.55;
	}

	.tiers {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1rem;
	}

	.tier {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		min-width: 0;
		padding: 1.25rem 1.15rem 1.35rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		animation: rise 0.7s ease both;
		animation-delay: calc(var(--i) * 70ms);
	}

	.tier.featured {
		border-color: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.tier.current {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		border-color: var(--hard-border);
	}

	.tier-badge {
		position: absolute;
		top: 0;
		right: 0;
		margin: 0;
		padding: 0.2rem 0.45rem;
		color: var(--on-accent);
		background: var(--accent);
		font-size: 0.6rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.tier-top {
		display: grid;
		gap: 0.35rem;
		padding-right: 4.5rem;
	}

	h3 {
		margin: 0;
		font-size: clamp(1.45rem, 2vw, 1.85rem);
		line-height: 1;
	}

	.price {
		display: flex;
		gap: 0.3rem;
		align-items: baseline;
		margin: 0;
	}

	.amount {
		font-family: var(--font-editorial);
		font-size: 1.65rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1;
	}

	.per {
		color: var(--muted);
		font-size: 0.75rem;
	}

	.blurb {
		margin: 0;
		color: color-mix(in srgb, var(--muted) 82%, var(--ink));
		font-size: 0.8125rem;
		line-height: 1.4;
	}

	ul {
		flex: 1;
		display: grid;
		gap: 0.35rem;
		margin: 0.15rem 0 0.35rem;
		padding: 0;
		list-style: none;
		font-size: 0.78rem;
		line-height: 1.35;
		color: color-mix(in srgb, var(--muted) 70%, var(--ink));
	}

	li {
		padding-left: 0.85rem;
		position: relative;
	}

	li::before {
		position: absolute;
		left: 0;
		color: var(--accent);
		content: '›';
		font-weight: 900;
	}

	.cta {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: auto;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 4px 4px 0 var(--hard-shadow);
		font-size: 0.65rem;
		font-weight: 900;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		text-decoration: none;
	}

	.cta.ghost {
		border-color: var(--hard-border);
		color: var(--ink);
		background: transparent;
	}

	.cta.upgrade {
		border-color: var(--ink);
		color: var(--on-accent);
		background: var(--accent);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.6rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 960px) {
		.tiers {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 560px) {
		.tiers {
			grid-template-columns: 1fr;
		}

		.tier-top {
			padding-right: 0;
		}
	}
</style>
