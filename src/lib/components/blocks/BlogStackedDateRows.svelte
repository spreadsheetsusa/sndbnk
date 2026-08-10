<script>
	/**
	 * @type {{
	 *   posts?: Array<{ date: string, title: string, body: string, linkLabel: string, linkHref: string }>
	 * }}
	 */
	let {
		posts = [
			{
				date: 'Aug 2',
				title: 'New single out now',
				body: 'Streaming everywhere — stems for supporters drop Friday.',
				linkLabel: 'Read post',
				linkHref: '/'
			},
			{
				date: 'Jul 18',
				title: 'Radio session recap',
				body: 'Three unreleased tracks and a live vocoder pass from the booth.',
				linkLabel: 'Read post',
				linkHref: '/'
			},
			{
				date: 'Jul 4',
				title: 'Festival set uploaded',
				body: 'Full hour from the main stage, waveform and tracklist included.',
				linkLabel: 'Read post',
				linkHref: '/'
			}
		]
	} = $props();
</script>

<section class="content">
	<div class="rows">
		{#each posts as post (post.title)}
			<article>
				<time datetime={post.date}>{post.date}</time>
				<div class="copy">
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

	.rows {
		display: grid;
		gap: 0;
	}

	article {
		display: grid;
		grid-template-columns: minmax(3.5rem, 5rem) 1fr;
		gap: 1.25rem;
		align-items: start;
		padding: 1.1rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
	}

	article:first-child {
		padding-top: 0;
	}

	article:last-child {
		padding-bottom: 0;
		border-bottom: 0;
	}

	@media (max-width: 520px) {
		article {
			grid-template-columns: 1fr;
			gap: 0.35rem;
		}
	}

	time {
		font-family: var(--font-editorial);
		font-size: 0.92rem;
		font-weight: 500;
		color: var(--muted);
	}

	.copy {
		display: grid;
		gap: 0.35rem;
	}

	h3 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 500;
	}

	.copy p {
		margin: 0;
		color: var(--muted);
		font-size: 0.92rem;
		line-height: 1.45;
	}

	a {
		color: var(--accent);
		text-decoration: none;
		font-size: 0.88rem;
	}
</style>
