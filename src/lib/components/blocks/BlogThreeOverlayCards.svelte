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
				title: 'Live at Signal Room',
				body: 'A full-set recording with notes on the signal chain.',
				linkLabel: 'Listen & read',
				linkHref: '/',
				imageLabel: 'Live set'
			},
			{
				title: 'Remix culture',
				body: 'Why stems matter when you want fans to flip your work.',
				linkLabel: 'Read post',
				linkHref: '/',
				imageLabel: 'Remix'
			},
			{
				title: 'Pressing vinyl',
				body: 'From master to jacket — what changed for the lathe cut.',
				linkLabel: 'Read post',
				linkHref: '/',
				imageLabel: 'Vinyl'
			}
		]
	} = $props();
</script>

<section class="content">
	<div class="grid">
		{#each posts as post (post.title)}
			<article>
				<MediaPlaceholder label={post.imageLabel} ratio="3 / 4" />
				<div class="overlay">
					<h3>{post.title}</h3>
					<p>{post.body}</p>
					<a href={post.linkHref}>{post.linkLabel}</a>
				</div>
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
		gap: 0.85rem;
	}

	@media (max-width: 800px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	article {
		position: relative;
		overflow: hidden;
	}

	.overlay {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		display: grid;
		gap: 0.35rem;
		padding: 0.85rem;
		background: color-mix(in srgb, var(--paper) 82%, var(--ink));
	}

	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 500;
	}

	.overlay p {
		margin: 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.4;
	}

	a {
		color: var(--accent);
		text-decoration: none;
		font-size: 0.85rem;
	}
</style>
