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
		'A station for your music. Upload tracks, share a link. Free holds about fifteen — then Vault.';

	const tiles = [
		{
			id: 'files',
			label: 'Files',
			title: 'Drop the record',
			body: 'Upload a track. Share the URL. The page is public the same day.'
		},
		{
			id: 'station',
			label: 'Station',
			title: 'You run it',
			body: 'Path profile on Free. you.sndbnk.com on Vault. Your domain on Studio.'
		},
		{
			id: 'listen',
			label: 'Listen',
			title: 'Built to play',
			body: 'Waveforms, comments, and a header player that stays with the listener.'
		},
		{
			id: 'fifteen',
			label: 'Free',
			title: 'Up to 15',
			body: 'About one album. Vault if the catalog grows.'
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
			title="A station you run."
			lede="Upload tracks and share a link. Free holds about fifteen — one album. Vault when the catalog grows."
			primaryHref="/signup"
			primaryLabel="Start free"
			secondaryHref="/plans"
			secondaryLabel="See plans"
			titleId="for-artists-title"
		/>

		<ProofStrip
			cells={[
				{
					id: 'files',
					label: 'Files',
					body: 'Upload audio. The page is public the same day.'
				},
				{
					id: 'station',
					label: 'Station',
					body: 'Listeners come to you — not a slot in someone else’s list.'
				},
				{
					id: 'play',
					label: 'Play',
					body: 'Waveform, comments, a player that stays put.'
				},
				{
					id: 'fifteen',
					label: 'Free',
					body: 'Fifteen tracks. Same station when you keep going.'
				}
			]}
		/>

		<ScContrast
			eyebrow="Contrast"
			leftLabel="Their feed"
			leftBody="You upload into someone else’s machine. They keep the chrome and the rules."
			rightLabel="Your station"
			rightBody="You host the files and the page. The address is yours to grow."
			line="They have a feed. You have a station."
		/>

		<section class="tiles" aria-labelledby="tiles-title">
			<div class="tiles-head">
				<p class="eyebrow accent-text eyebrow-chip">Station</p>
				<h2 id="tiles-title">What you actually get.</h2>
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
			<h2 id="close-title">Start with the files.</h2>
			<p>Fifteen tracks. A public station. Open an account.</p>
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
