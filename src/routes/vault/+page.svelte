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
		'Vault is $5 — unlimited tracks and you.sndbnk.com. The fifteen-track wall comes off.';

	const ladder = [
		{
			id: 'free',
			label: 'Free',
			title: 'One album',
			body: 'About fifteen tracks and a path profile. Enough to put a record up.'
		},
		{
			id: 'wall',
			label: 'Wall',
			title: 'Album wall',
			body: 'Free stops at fifteen. That’s the cap — Vault takes the count off.'
		},
		{
			id: 'vault',
			label: 'Vault',
			title: '$5. Capacity',
			body: 'Unlimited tracks. you.sndbnk.com. Same station, room to keep adding.'
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
			title="Fifteen tracks. Then Vault."
			lede="$5. Unlimited tracks and you.sndbnk.com. Same station, no track cap."
			primaryHref="/plans?plan=vault"
			primaryLabel="Choose Vault"
			secondaryHref="/signup"
			secondaryLabel="Start free"
			titleId="vault-title"
		>
			{#snippet support()}
				<p>Vault is capacity. The catalog can grow.</p>
				<p>
					<a href="/studio">Need a domain? That’s Studio.</a>
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
					id: 'tracks',
					label: 'Tracks',
					body: 'The fifteen-track cap is gone.'
				},
				{
					id: 'host',
					label: 'Host',
					body: 'you.sndbnk.com — your name as a host, not a path.'
				},
				{
					id: 'same',
					label: 'Same',
					body: 'Same library and player. More room.'
				},
				{
					id: 'five',
					label: 'Five',
					body: '$5 a month. Capacity, not a new product.'
				}
			]}
		/>

		<section class="close" aria-labelledby="close-title">
			<p class="lcd-face">Unlock</p>
			<h2 id="close-title">Take the limiter off.</h2>
			<p>Unlimited tracks and you.sndbnk.com.</p>
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
