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
	const pageDescription =
		'Vault is room. Studio is yours — your domain, white-label, looks like your label.';

	const ownership = [
		{
			id: 'domain',
			label: 'Domain',
			title: 'Your name on the door',
			body: 'Your domain. This isn’t “upgrade to Pro.”'
		},
		{
			id: 'chrome',
			label: 'Chrome off',
			title: 'White-label',
			body: 'Looks like your label, not ours.'
		},
		{
			id: 'byos',
			label: 'BYOS',
			title: 'Your disks',
			body: 'BYOS if you want. Files stay on disks you already run.'
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
			title="Vault is room. Studio is yours."
			lede="$14. Your domain. White-label. Looks like your label, not ours. BYOS if you want."
			primaryHref="/plans?plan=studio"
			primaryLabel="Choose Studio"
			secondaryHref="/plans"
			secondaryLabel="See plans"
			titleId="studio-title"
		>
			{#snippet support()}
				<p>This isn’t “upgrade to Pro.” It’s your name on the door.</p>
			{/snippet}
		</FunnelHero>

		<section class="ownership" aria-labelledby="ownership-title">
			<div class="head">
				<p class="eyebrow accent-text eyebrow-chip">Yours</p>
				<h2 id="ownership-title">Own the station under your domain.</h2>
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
			eyebrow="Room vs yours"
			leftLabel="Vault"
			leftBody="Vault is room. $5. Unlimited tracks. Same station — more of your shit fits."
			rightLabel="Studio"
			rightBody="Studio is yours. $14. Your domain. White-label. Looks like your label, not ours."
			line="Vault is room. Studio is yours."
		/>

		<ProofStrip
			cells={[
				{
					id: 'name',
					label: 'Name',
					body: 'This isn’t “upgrade to Pro.” It’s your name on the door.'
				},
				{
					id: 'domain',
					label: 'Domain',
					body: 'Own a freeform station under your domain.'
				},
				{
					id: 'signal',
					label: 'Signal',
					body: 'NTS / WFMU / dublab energy at personal scale.'
				},
				{
					id: 'byos',
					label: 'BYOS',
					body: 'Bring your own disks if you want.'
				}
			]}
		/>

		<section class="close" aria-labelledby="close-title">
			<p class="lcd-face">Own it</p>
			<h2 id="close-title">Your name on the door.</h2>
			<p>Choose Studio. Your domain. Chrome off.</p>
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
