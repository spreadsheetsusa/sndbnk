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
		headline = 'Drop the next release',
		body = 'A clean page for the track, the story, and the people who show up for it.',
		primaryLabel = 'Upload a track',
		primaryHref = '/',
		secondaryLabel = 'Browse artists',
		secondaryHref = '/',
		imageLabel = 'Hero visual'
	} = $props();
</script>

<section class="hero">
	<div class="media">
		<MediaPlaceholder label={imageLabel} ratio="21 / 9" />
	</div>
	<div class="copy">
		<h2>{headline}</h2>
		<p>{body}</p>
		<div class="actions">
			<a class="primary accent-fill" href={primaryHref}>{primaryLabel}</a>
			<a class="secondary" href={secondaryHref}>{secondaryLabel}</a>
		</div>
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

	.media {
		width: min(100%, 42rem);
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
