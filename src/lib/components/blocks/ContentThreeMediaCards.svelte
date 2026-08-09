<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   heading?: string,
	 *   subcopy?: string,
	 *   cards?: Array<{ title: string, body: string, linkLabel: string, linkHref: string, imageLabel: string }>
	 * }}
	 */
	let {
		heading = 'From the vault',
		subcopy = 'Three ways to show the work without burying the waveform.',
		cards = [
			{
				title: 'Latest single',
				body: 'Lead with cover art and a short hook.',
				linkLabel: 'Play',
				linkHref: '/',
				imageLabel: 'Single'
			},
			{
				title: 'Club mix',
				body: 'Long-form audio with room to breathe.',
				linkLabel: 'Open mix',
				linkHref: '/',
				imageLabel: 'Mix'
			},
			{
				title: 'Sample pack',
				body: 'Loops and one-shots ready for the next session.',
				linkLabel: 'Browse',
				linkHref: '/',
				imageLabel: 'Pack'
			}
		]
	} = $props();
</script>

<section class="content">
	<header>
		<h2>{heading}</h2>
		<p>{subcopy}</p>
	</header>
	<div class="grid">
		{#each cards as card (card.title)}
			<article>
				<MediaPlaceholder label={card.imageLabel} ratio="16 / 10" />
				<h3>{card.title}</h3>
				<p>{card.body}</p>
				<a href={card.linkHref}>{card.linkLabel}</a>
			</article>
		{/each}
	</div>
</section>

<style>
	.content {
		display: grid;
		gap: 1.25rem;
		padding: 2rem 0;
	}

	header {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		align-items: end;
	}

	@media (max-width: 720px) {
		header {
			grid-template-columns: 1fr;
		}
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.35rem, 2.4vw, 1.75rem);
		font-weight: 500;
	}

	header p {
		margin: 0;
		color: var(--muted);
		line-height: 1.45;
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
