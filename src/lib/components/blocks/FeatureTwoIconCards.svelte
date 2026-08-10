<script>
	/**
	 * @type {{
	 *   cards?: Array<{ title: string, body: string }>
	 * }}
	 */
	let {
		cards = [
			{
				title: 'Global player',
				body: 'Queue survives navigation so listeners never lose the thread.'
			},
			{
				title: 'Custom domains',
				body: 'Point your apex or subdomain and keep the SNDBNK player.'
			}
		]
	} = $props();
</script>

<section class="content">
	<div class="grid">
		{#each cards as card (card.title)}
			<article>
				<span class="icon" aria-hidden="true"></span>
				<h3>{card.title}</h3>
				<p>{card.body}</p>
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
		gap: 1rem;
	}

	@media (max-width: 640px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	article {
		display: grid;
		gap: 0.35rem;
		align-content: start;
		padding: 0.85rem;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.icon {
		width: 1.5rem;
		height: 1.5rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
	}

	h3 {
		margin: 0.2rem 0 0;
		font-size: 1rem;
		font-weight: 500;
	}

	p {
		margin: 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.4;
	}
</style>
