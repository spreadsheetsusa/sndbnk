<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   headline?: string,
	 *   body?: string,
	 *   primaryLabel?: string,
	 *   primaryHref?: string,
	 *   secondaryLabel?: string,
	 *   secondaryHref?: string,
	 *   imageLabel?: string
	 * }}
	 */
	let {
		headline = 'Your sound, your stage',
		body = 'Upload tracks, build a page, and share a link that actually sounds like you.',
		primaryLabel = 'Start listening',
		primaryHref = '/',
		secondaryLabel = 'See the feed',
		secondaryHref = '/',
		imageLabel = 'Cover art'
	} = $props();
</script>

<section class="hero">
	<div class="copy">
		<h2>{headline}</h2>
		<p>{body}</p>
		<div class="actions">
			<a class="primary accent-fill" href={primaryHref}>{primaryLabel}</a>
			<a class="secondary" href={secondaryHref}>{secondaryLabel}</a>
		</div>
	</div>
	<div class="media">
		<MediaPlaceholder label={imageLabel} ratio="5 / 4" />
	</div>
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
		background: transparent;
	}
</style>
