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
		headline = 'One link for every release',
		body = 'Share a page that carries cover art, waveform, and the next listen.',
		primaryLabel = 'Get started',
		primaryHref = '/',
		secondaryLabel = 'Explore features',
		secondaryHref = '/',
		imageLabel = 'Featured release'
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
			<a class="secondary" href={secondaryHref}>{secondaryLabel}</a>
			<a class="primary accent-fill" href={primaryHref}>{primaryLabel}</a>
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
		display: grid;
		gap: 0.5rem;
		width: min(100%, 18rem);
	}

	.primary,
	.secondary {
		padding: 0.6rem 0.9rem;
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
