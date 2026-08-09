<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   leftTitle?: string,
	 *   leftBody?: string,
	 *   leftCtaLabel?: string,
	 *   leftCtaHref?: string,
	 *   leftImageLabel?: string,
	 *   rightTitle?: string,
	 *   rightBody?: string,
	 *   rightCtaLabel?: string,
	 *   rightCtaHref?: string,
	 *   rightImageLabel?: string
	 * }}
	 */
	let {
		leftTitle = 'For artists',
		leftBody = 'Upload, tag, and publish without leaving the deck.',
		leftCtaLabel = 'Go to library',
		leftCtaHref = '/',
		leftImageLabel = 'Artist tools',
		rightTitle = 'For listeners',
		rightBody = 'Follow profiles, queue mixes, and keep the player with you.',
		rightCtaLabel = 'Open the feed',
		rightCtaHref = '/',
		rightImageLabel = 'Listener tools'
	} = $props();
</script>

<section class="content">
	<article>
		<MediaPlaceholder label={leftImageLabel} ratio="16 / 10" />
		<h3>{leftTitle}</h3>
		<p>{leftBody}</p>
		<a href={leftCtaHref}>{leftCtaLabel}</a>
	</article>
	<article>
		<MediaPlaceholder label={rightImageLabel} ratio="16 / 10" />
		<h3>{rightTitle}</h3>
		<p>{rightBody}</p>
		<a href={rightCtaHref}>{rightCtaLabel}</a>
	</article>
</section>

<style>
	.content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
		padding: 2rem 0;
	}

	@media (max-width: 720px) {
		.content {
			grid-template-columns: 1fr;
		}
	}

	article {
		display: grid;
		gap: 0.55rem;
		align-content: start;
	}

	h3 {
		margin: 0.25rem 0 0;
		font-family: var(--font-editorial);
		font-size: 1.15rem;
		font-weight: 500;
	}

	p {
		margin: 0;
		color: var(--muted);
		line-height: 1.45;
	}

	a {
		color: var(--accent);
		text-decoration: none;
		font-size: 0.9rem;
	}
</style>
