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
		headline = 'Host the catalog. Own the page.',
		body = 'Bring mixes, samples, and podcasts into one place listeners can actually find.',
		showPrimary = true,
		primaryLabel = 'Create your site',
		primaryHref = '/',
		showSecondary = true,
		secondaryLabel = 'How hosting works',
		secondaryHref = '/',
		imageLabel = 'Catalog visual',
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
	<div class="copy">
		<h2>{headline}</h2>
		<p>{body}</p>
		{#if primaryOn || secondaryOn}
			<div class="actions">
				{#if secondaryOn}
					<a class="secondary wide" href={secondaryHref}>{secondaryLabel}</a>
				{/if}
				{#if primaryOn}
					<a class="primary accent-fill" href={primaryHref}>{primaryLabel}</a>
				{/if}
			</div>
		{/if}
	</div>
	<HeroMedia
		label={imageLabel}
		mediaId={imageId}
		kind={imageKind}
		fallbackRatio="5 / 4"
		{imageRatio}
		{imageWidth}
		{imageBorder}
	/>
</section>

<style>
	.hero {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
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
	}

	p {
		margin: 0 0 1.1rem;
		color: var(--muted);
		max-width: 36ch;
		line-height: 1.45;
	}

	.actions {
		display: grid;
		gap: 0.5rem;
		max-width: 18rem;
	}

	.primary,
	.secondary {
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--ink);
		text-decoration: none;
		font-size: 0.9rem;
		text-align: center;
	}

	.primary {
		color: var(--on-accent);
	}

	.secondary {
		color: var(--ink);
	}
</style>
