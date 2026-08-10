<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   posts?: Array<{ title: string, body: string, linkLabel: string, linkHref: string, imageLabel: string }>
	 * }}
	 */
	let {
		posts = [
			{
				title: 'Studio diary: night sessions',
				body: 'How the last EP came together between live takes and late-night edits.',
				linkLabel: 'Read post',
				linkHref: '/',
				imageLabel: 'Studio'
			},
			{
				title: 'Tour recap: three cities',
				body: 'Setlists, crowd recordings, and the tracks that landed hardest on the road.',
				linkLabel: 'Read post',
				linkHref: '/',
				imageLabel: 'Tour'
			},
			{
				title: 'Sample pack breakdown',
				body: 'What went into the kit and how to use the one-shots in your DAW.',
				linkLabel: 'Read post',
				linkHref: '/',
				imageLabel: 'Pack'
			}
		]
	} = $props();
</script>

<section class="content">
	<div class="grid">
		{#each posts as post (post.title)}
			<article>
				<MediaPlaceholder label={post.imageLabel} ratio="16 / 10" />
				<h3>{post.title}</h3>
				<p>{post.body}</p>
				<a href={post.linkHref}>{post.linkLabel}</a>
			</article>
		{/each}
	</div>
</section>

<style>
	.content {
		padding: 2rem 0;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
	}

	@media (max-width: 800px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	article {
		display: grid;
		gap: 0.45rem;
		align-content: start;
		padding: 0.85rem;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	h3 {
		margin: 0.2rem 0 0;
		font-size: 1.05rem;
		font-weight: 500;
	}

	article p {
		margin: 0;
		color: var(--muted);
		font-size: 0.92rem;
		line-height: 1.4;
	}

	a {
		color: var(--accent);
		text-decoration: none;
		font-size: 0.88rem;
	}
</style>
