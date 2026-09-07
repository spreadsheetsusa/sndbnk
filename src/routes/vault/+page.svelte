<script>
	import SeoHead from '#lib/components/SeoHead.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import CtaCartridge from '#lib/components/funnel/CtaCartridge.svelte';
	import FunnelHero from '#lib/components/funnel/FunnelHero.svelte';
	import ProofStrip from '#lib/components/funnel/ProofStrip.svelte';

	let { data } = $props();

	const pageTitle = 'Vault | SNDBNK';
	const pageDescription =
		'You hit 15. Vault is $5 — unlimited tracks, same station, room to keep stacking.';

	const ladder = [
		{
			id: 'free',
			label: 'Free',
			title: 'Fifteen tracks',
			body: 'Drop in. Share a link. That’s the start — not a ceiling forever.'
		},
		{
			id: 'wall',
			label: 'Wall',
			title: 'You hit 15',
			body: 'That’s the wall. The limiter, not a lecture.'
		},
		{
			id: 'vault',
			label: 'Vault',
			title: '$5. No ceiling',
			body: 'Unlimited tracks. Room to keep stacking. Same station — more of your shit fits.'
		}
	];
</script>

<SeoHead
	title={pageTitle}
	description={pageDescription}
	canonical={`${data.siteOrigin}/vault`}
	origin={data.siteOrigin}
	type="website"
/>

<div class="funnel">
	<SiteHeader />

	<main id="main">
		<FunnelHero
			eyebrow="Vault"
			title="You hit 15. That’s the wall."
			lede="Vault is $5. Unlimited tracks. Room to keep stacking. Same station — more of your shit fits."
			primaryHref="/plans?plan=vault"
			primaryLabel="Choose Vault"
			secondaryHref="/signup"
			secondaryLabel="Start free"
			titleId="vault-title"
		>
			{#snippet support()}
				<p>Not a storage plan. Just no ceiling.</p>
				<p>
					<a href="/studio">Vault is room. Studio is yours.</a>
				</p>
			{/snippet}
		</FunnelHero>

		<section class="ladder" aria-labelledby="ladder-title">
			<div class="head">
				<p class="eyebrow accent-text eyebrow-chip">Ladder</p>
				<h2 id="ladder-title">Free. Wall. Vault.</h2>
			</div>
			<ol>
				{#each ladder as rung, i (rung.id)}
					<li class:current={rung.id === 'vault'}>
						<span class="lcd-face index" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
						<p class="lcd-face">{rung.label}</p>
						<h3>{rung.title}</h3>
						<p>{rung.body}</p>
					</li>
				{/each}
			</ol>
		</section>

		<ProofStrip
			cells={[
				{
					id: 'ceiling',
					label: 'Ceiling',
					body: 'Not a storage plan. Just no ceiling.'
				},
				{
					id: 'archive',
					label: 'Archive',
					body: 'Keep masters and dumps on your station — room to stack, no ceiling.'
				},
				{
					id: 'stacks',
					label: 'Stacks',
					body: 'Archive heads, noise walls, tape dumps.'
				},
				{
					id: 'five',
					label: 'Five',
					body: 'Vault is $5. Unlimited tracks. Same station.'
				}
			]}
		/>

		<section class="close" aria-labelledby="close-title">
			<p class="lcd-face">Unlock</p>
			<h2 id="close-title">Same station. More of your shit fits.</h2>
			<p>Choose Vault. Not a storage plan. Just no ceiling.</p>
			<CtaCartridge href="/plans?plan=vault" label="Choose Vault" />
		</section>
	</main>

	<SiteFooter bordered />
</div>

<style>
	.funnel {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) clamp(1.25rem, 4vw, 2.5rem);
	}

	main {
		display: grid;
		gap: clamp(2rem, 5vw, 3.5rem);
		padding: clamp(1.25rem, 3vw, 2rem) 0 0;
	}

	.ladder,
	.close,
	.head {
		display: grid;
		gap: 1.15rem;
	}

	.head {
		gap: 0.65rem;
	}

	.eyebrow {
		margin: 0;
		width: fit-content;
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.6rem, 3.4vw, 2.4rem);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	ol {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li,
	.close {
		display: grid;
		gap: 0.55rem;
		padding: 1.25rem 1.3rem 1.4rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	li.current {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 10%, var(--paper));
	}

	.lcd-face,
	.index {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.index {
		justify-self: start;
	}

	h3,
	.close p:not(.lcd-face),
	li p:last-child {
		margin: 0;
	}

	h3 {
		font-family: var(--font-editorial);
		font-size: 1.15rem;
		font-weight: 700;
	}

	li p:last-child,
	.close p:not(.lcd-face) {
		color: var(--muted);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	@media (max-width: 960px) {
		ol {
			grid-template-columns: 1fr;
		}
	}
</style>
