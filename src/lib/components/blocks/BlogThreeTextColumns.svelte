<script>
	/**
	 * @type {{
	 *   posts?: Array<{ chip: string, title: string, body: string, author: string }>
	 * }}
	 */
	let {
		posts = [
			{
				chip: 'Mix',
				title: 'Closing time selections',
				body: 'Slow-burners and one surprise uptempo cut for the last hour.',
				author: 'DJ North'
			},
			{
				chip: 'Production',
				title: 'Sidechain without the pump',
				body: 'Ducking the bass with a envelope follower instead of a square LFO.',
				author: 'Kira Vox'
			},
			{
				chip: 'Community',
				title: 'Fan edits we loved',
				body: 'Three remixes that stayed respectful of the original groove.',
				author: 'Echo Unit'
			}
		]
	} = $props();
</script>

<section class="content">
	<div class="grid">
		{#each posts as post (post.title)}
			<article>
				<p class="eyebrow eyebrow-chip">{post.chip}</p>
				<h3>{post.title}</h3>
				<p>{post.body}</p>
				<footer>
					<span class="avatar" aria-hidden="true"></span>
					<p class="author">{post.author}</p>
				</footer>
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
		gap: 1.25rem;
	}

	@media (max-width: 800px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	article {
		display: grid;
		gap: 0.4rem;
		align-content: start;
	}

	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 500;
	}

	article > p {
		margin: 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.45;
	}

	footer {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.25rem;
	}

	.avatar {
		width: 1.65rem;
		height: 1.65rem;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		background: color-mix(in srgb, var(--accent) 16%, var(--paper));
		flex-shrink: 0;
	}

	.author {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 500;
	}
</style>
