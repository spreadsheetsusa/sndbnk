<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   imageLabel?: string,
	 *   items?: Array<{ title: string, body: string }>
	 * }}
	 */
	let {
		imageLabel = 'Studio session',
		items = [
			{ title: 'Drop and tag', body: 'Metadata autofills from the file so you edit less.' },
			{ title: 'Publish when ready', body: 'Draft privately, then flip the switch for the feed.' },
			{ title: 'Embed the player', body: 'Waveform and queue follow listeners off-site.' }
		]
	} = $props();
</script>

<section class="content">
	<div class="media">
		<MediaPlaceholder label={imageLabel} ratio="4 / 5" />
	</div>
	<div class="list">
		{#each items as item (item.title)}
			<article>
				<span class="icon" aria-hidden="true"></span>
				<div>
					<h3>{item.title}</h3>
					<p>{item.body}</p>
				</div>
			</article>
		{/each}
	</div>
</section>

<style>
	.content {
		display: grid;
		grid-template-columns: 0.9fr 1.1fr;
		gap: 1.5rem;
		padding: 2rem 0;
	}

	@media (max-width: 800px) {
		.content {
			grid-template-columns: 1fr;
		}
	}

	.list {
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	article {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.75rem;
		align-items: start;
		padding-bottom: 1rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	article:last-child {
		padding-bottom: 0;
		border-bottom: 0;
	}

	.icon {
		width: 1.5rem;
		height: 1.5rem;
		margin-top: 0.1rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
	}

	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 500;
	}

	p {
		margin: 0.3rem 0 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.4;
	}
</style>
