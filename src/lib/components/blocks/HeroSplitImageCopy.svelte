<script>
	import HeroMedia from '#lib/components/blocks/HeroMedia.svelte';
	import { showHeroCta } from '#lib/components/blocks/hero-frame.js';

	/**
	 * @type {{
	 *   headline?: string,
	 *   body?: string,
	 *   showPrimary?: boolean,
	 *   primaryLabel?: string,
	 *   primaryHref?: string,
	 *   showSecondary?: boolean,
	 *   secondaryLabel?: string,
	 *   secondaryHref?: string,
	 *   imageLabel?: string,
	 *   imageId?: string,
	 *   imageKind?: string,
	 *   imageRatio?: string,
	 *   imageWidth?: string,
	 *   imageBorder?: boolean
	 * }}
	 */
	let {
		headline = 'Studio tools, listener-ready',
		body = 'Waveforms, playlists, and a profile that works on your domain.',
		showPrimary = true,
		primaryLabel = 'Open library',
		primaryHref = '/',
		showSecondary = true,
		secondaryLabel = 'Compare plans',
		secondaryHref = '/',
		imageLabel = 'Studio shot',
		imageId = '',
		imageKind = '',
		imageRatio = '',
		imageWidth = '',
		imageBorder = true
	} = $props();

	const primaryOn = $derived(showHeroCta(showPrimary, primaryLabel));
	const secondaryOn = $derived(showHeroCta(showSecondary, secondaryLabel));
</script>

<section class="hero">
	<HeroMedia
		label={imageLabel}
		mediaId={imageId}
		kind={imageKind}
		fallbackRatio="5 / 4"
		{imageRatio}
		{imageWidth}
		{imageBorder}
	/>
	<div class="copy">
		<h2>{headline}</h2>
		<p>{body}</p>
		{#if primaryOn || secondaryOn}
			<div class="actions">
				{#if primaryOn}
					<a class="primary accent-fill" href={primaryHref}>{primaryLabel}</a>
				{/if}
				{#if secondaryOn}
					<a class="secondary" href={secondaryHref}>{secondaryLabel}</a>
				{/if}
			</div>
		{/if}
	</div>
</section>

<style>
	.hero {
		display: grid;
		grid-template-columns: 0.9fr 1.1fr;
		gap: 1.75rem;
		align-items: center;
		padding: 2rem 0;
	}

	@media (max-width: 720px) {
		.hero {
			grid-template-columns: 1fr;
		}
	}

	h2 {
		margin: 0 0 0.65rem;
		font-family: var(--font-editorial);
		font-size: clamp(1.6rem, 3vw, 2.2rem);
		font-weight: 500;
		line-height: 1.15;
	}

	p {
		margin: 0 0 1.1rem;
		color: var(--muted);
		max-width: 34ch;
		line-height: 1.45;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.primary,
	.secondary {
		padding: 0.55rem 0.9rem;
		border: 1px solid var(--ink);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.primary {
		color: var(--on-accent);
	}

	.secondary {
		color: var(--ink);
	}
</style>
