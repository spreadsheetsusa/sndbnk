<script>
	/**
	 * @type {{
	 *   quotes?: Array<{ quote: string, name: string, role: string }>
	 * }}
	 */
	let {
		quotes = [
			{
				quote:
					'Stems, cover art, and a public page that loads fast — exactly what I needed for the release cycle.',
				name: 'DJ North',
				role: 'Artist · Montreal'
			},
			{
				quote: 'The global player and queue follow me across the site. Listeners stay in the mix.',
				name: 'Ada Frequency',
				role: 'Producer · Berlin'
			},
			{
				quote: 'Custom domain verification was painless. My catalog lives on my name now.',
				name: 'Signal Room',
				role: 'Collective · NYC'
			}
		]
	} = $props();
</script>

<section class="content">
	<div class="grid">
		{#each quotes as item (item.name)}
			<blockquote>
				<span class="avatar" aria-hidden="true"></span>
				<p>&ldquo;{item.quote}&rdquo;</p>
				<span class="bar" aria-hidden="true"></span>
				<footer>
					<p class="name">{item.name}</p>
					<p class="role">{item.role}</p>
				</footer>
			</blockquote>
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

	blockquote {
		margin: 0;
		display: grid;
		gap: 0.65rem;
		align-content: start;
	}

	.avatar {
		width: 2.5rem;
		height: 2.5rem;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		border-radius: 50%;
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
	}

	blockquote > p {
		margin: 0;
		font-size: 0.92rem;
		line-height: 1.5;
		color: var(--muted);
	}

	.bar {
		width: 2rem;
		height: 3px;
		background: var(--accent);
	}

	.name {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.role {
		margin: 0.15rem 0 0;
		color: var(--muted);
		font-size: 0.82rem;
	}
</style>
