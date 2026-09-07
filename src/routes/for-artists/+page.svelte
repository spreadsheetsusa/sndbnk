<script>
	import SeoHead from '#lib/components/SeoHead.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import CtaCartridge from '#lib/components/funnel/CtaCartridge.svelte';
	import FunnelHero from '#lib/components/funnel/FunnelHero.svelte';
	import ProofStrip from '#lib/components/funnel/ProofStrip.svelte';
	import ScContrast from '#lib/components/funnel/ScContrast.svelte';

	let { data } = $props();

	const pageTitle = 'For artists | SNDBNK';
	const pageDescription =
		'Your music. Your station. Drop tracks and share a link — free up to 15, then Vault if you keep going.';

	const tiles = [
		{
			id: 'files',
			label: 'Files',
			title: 'Drop the record',
			body: 'Drop tracks. Share a link that doesn’t feel like homework.'
		},
		{
			id: 'station',
			label: 'Station',
			title: 'You run it',
			body: 'A station you run — not a feed you rent.'
		},
		{
			id: 'diy',
			label: 'DIY',
			title: 'Underground energy',
			body: 'Mod Archive / WFMU / Neocities energy. Files plus a real place to play.'
		},
		{
			id: 'fifteen',
			label: 'Free',
			title: 'Up to 15',
			body: 'Free up to 15 — then Vault if you keep going.'
		}
	];
</script>

<SeoHead
	title={pageTitle}
	description={pageDescription}
	canonical={`${data.siteOrigin}/for-artists`}
	origin={data.siteOrigin}
	type="website"
/>

<div class="funnel">
	<SiteHeader />

	<main id="main">
		<FunnelHero
			eyebrow="For artists"
			title="Your music. Your station. Not someone else’s feed."
			lede="Drop tracks. Share a link that doesn’t feel like homework. Free up to 15 — then Vault if you keep going."
			primaryHref="/signup"
			primaryLabel="Start free"
			secondaryHref="/plans"
			secondaryLabel="See plans"
			titleId="for-artists-title"
		/>

		<ProofStrip
			cells={[
				{
					id: 'winamp',
					label: 'Winamp',
					body: 'Built for artists who still remember Winamp.'
				},
				{
					id: 'diy',
					label: 'DIY',
					body: 'Files + a real place to play, not a rented feed.'
				},
				{
					id: 'hooks',
					label: 'Hooks',
					body: 'Mod Archive / WFMU / Neocities energy.'
				},
				{
					id: 'fifteen',
					label: 'Fifteen',
					body: 'Free up to 15. Same station when you keep going.'
				}
			]}
		/>

		<ScContrast />

		<section class="tiles" aria-labelledby="tiles-title">
			<div class="tiles-head">
				<p class="eyebrow accent-text eyebrow-chip">Station</p>
				<h2 id="tiles-title">Your music. Your station.</h2>
			</div>
			<ol>
				{#each tiles as tile (tile.id)}
					<li>
						<p class="lcd-face">{tile.label}</p>
						<h3>{tile.title}</h3>
						<p>{tile.body}</p>
					</li>
				{/each}
			</ol>
		</section>

		<section class="close" aria-labelledby="close-title">
			<p class="lcd-face">On air</p>
			<h2 id="close-title">Your music. Your station.</h2>
			<p>Start free. Fifteen tracks. A link that doesn’t feel like homework.</p>
			<CtaCartridge href="/signup" label="Start free" />
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

	.tiles,
	.close {
		display: grid;
		gap: 1.15rem;
	}

	.tiles-head,
	.close {
		display: grid;
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
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li,
	.close {
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
	.close p:not(.lcd-face) {
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

	@media (max-width: 640px) {
		ol {
			grid-template-columns: 1fr;
		}
	}
</style>
