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
		headline = 'Drop the next release',
		body = 'A clean page for the track, the story, and the people who show up for it.',
		showPrimary = true,
		primaryLabel = 'Upload a track',
		primaryHref = '/',
		showSecondary = true,
		secondaryLabel = 'Browse artists',
		secondaryHref = '/',
		imageLabel = 'Hero visual',
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
		--hero-media-cap="42rem"
		label={imageLabel}
		mediaId={imageId}
		kind={imageKind}
		fallbackRatio="21 / 9"
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
		gap: 1.25rem;
		justify-items: center;
		padding: 2rem 0;
		text-align: center;
	}

	h2 {
		margin: 0 0 0.55rem;
		font-family: var(--font-editorial);
		font-size: clamp(1.6rem, 3vw, 2.2rem);
		font-weight: 500;
	}

	p {
		margin: 0 auto 1rem;
		color: var(--muted);
		max-width: 42ch;
		line-height: 1.45;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
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
