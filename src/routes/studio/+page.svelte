<script>
	import SeoHead from '#lib/components/SeoHead.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import CtaCartridge from '#lib/components/funnel/CtaCartridge.svelte';
	import FunnelHero from '#lib/components/funnel/FunnelHero.svelte';
	import ProofStrip from '#lib/components/funnel/ProofStrip.svelte';
	import ScContrast from '#lib/components/funnel/ScContrast.svelte';

	let { data } = $props();

	const pageTitle = 'Studio | SNDBNK';
	const pageDescription = 'Studio is $14 — your domain, chrome off, and the full station builder.';

	const ownership = [
		{
			id: 'domain',
			label: 'Domain',
			title: 'Your address',
			body: 'Point a domain here. Listeners land on you, not a path on ours.'
		},
		{
			id: 'chrome',
			label: 'Chrome off',
			title: 'Unbranded',
			body: 'Platform chrome can go. The station reads as your project.'
		},
		{
			id: 'builder',
			label: 'Builder',
			title: 'Full station',
			body: 'Pages and blocks — the public face you actually want, not a fixed profile.'
		}
	];
</script>

<SeoHead
	title={pageTitle}
	description={pageDescription}
	canonical={`${data.siteOrigin}/studio`}
	origin={data.siteOrigin}
	type="website"
/>

<div class="funnel">
	<SiteHeader />

	<main id="main">
		<FunnelHero
			eyebrow="Studio"
			title="Your name. Your domain."
			lede="$14. Custom domain, chrome off, full station builder. The public site reads as yours."
			primaryHref="/plans?plan=studio"
			primaryLabel="Choose Studio"
			secondaryHref="/plans"
			secondaryLabel="See plans"
			titleId="studio-title"
		>
			{#snippet support()}
				<p>Vault holds the catalog. Studio puts your name on it.</p>
			{/snippet}
		</FunnelHero>

		<section class="ownership" aria-labelledby="ownership-title">
			<div class="head">
				<p class="eyebrow accent-text eyebrow-chip">Yours</p>
				<h2 id="ownership-title">What Studio adds.</h2>
			</div>
			<ol>
				{#each ownership as panel (panel.id)}
					<li>
						<p class="lcd-face">{panel.label}</p>
						<h3>{panel.title}</h3>
						<p>{panel.body}</p>
					</li>
				{/each}
			</ol>
		</section>

		<ScContrast
			eyebrow="Capacity vs ownership"
			leftLabel="Vault"
			leftBody="$5. Unlimited tracks and you.sndbnk.com. Room for the catalog."
			rightLabel="Studio"
			rightBody="$14. Your domain, chrome off, the full builder."
			line="Vault is capacity. Studio is ownership."
		/>

		<ProofStrip
			cells={[
				{
					id: 'domain',
					label: 'Domain',
					body: 'Listeners type your name, not ours.'
				},
				{
					id: 'chrome',
					label: 'Chrome',
					body: 'Unbranded station. Your accent, your pages.'
				},
				{
					id: 'builder',
					label: 'Builder',
					body: 'Compose the public site — not a fixed profile.'
				},
				{
					id: 'fourteen',
					label: 'Fourteen',
					body: '$14. Ownership, not a badge.'
				}
			]}
		/>

		<section class="close" aria-labelledby="close-title">
			<p class="lcd-face">Own it</p>
			<h2 id="close-title">Put your name on it.</h2>
			<p>Custom domain. Chrome off. The builder.</p>
			<CtaCartridge href="/plans?plan=studio" label="Choose Studio" />
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

	.ownership,
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

	.lcd-face {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
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
