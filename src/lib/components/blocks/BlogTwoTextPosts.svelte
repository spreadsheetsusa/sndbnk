<script>
	/**
	 * @type {{
	 *   posts?: Array<{ chip: string, title: string, body: string, linkLabel: string, linkHref: string, author: string }>
	 * }}
	 */
	let {
		posts = [
			{
				chip: 'Release notes',
				title: 'Why this mix is longer than the single',
				body: 'The club version keeps the drop, adds a breakdown, and lands near seven minutes.',
				linkLabel: 'Read post',
				linkHref: '/',
				author: 'Ada Frequency'
			},
			{
				chip: 'Gear',
				title: 'Analog warmth without losing the transients',
				body: 'A light tape pass on the bus — enough glue, not enough smear for the kick.',
				linkLabel: 'Read post',
				linkHref: '/',
				author: 'Mono Lake'
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
				<a href={post.linkHref}>{post.linkLabel}</a>
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
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.5rem;
	}

	@media (max-width: 720px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	article {
		display: grid;
		gap: 0.45rem;
		align-content: start;
	}

	h3 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 500;
	}

	article > p {
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

	footer {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin-top: 0.35rem;
		padding-top: 0.85rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
	}

	.avatar {
		width: 2rem;
		height: 2rem;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		border-radius: 50%;
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
		flex-shrink: 0;
	}

	.author {
		margin: 0;
		font-size: 0.88rem;
		font-weight: 500;
	}
</style>
