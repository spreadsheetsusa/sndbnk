<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   featuredImageLabel?: string,
	 *   featuredTitle?: string,
	 *   featuredBody?: string,
	 *   pair?: Array<{ imageLabel: string, title: string, body: string }>
	 * }}
	 */
	let {
		featuredImageLabel = 'Headliner',
		featuredTitle = 'Summer tour film',
		featuredBody = 'Behind the scenes from soundcheck to the last encore.',
		pair = [
			{
				imageLabel: 'Booth',
				title: 'In the mix',
				body: 'Three channels that never leave the live rig.'
			},
			{
				imageLabel: 'Merch',
				title: 'Limited run',
				body: 'Cassette repress with alternate art.'
			}
		]
	} = $props();
</script>

<section class="content">
	<article class="featured">
		<MediaPlaceholder label={featuredImageLabel} ratio="21 / 9" />
		<div class="overlay">
			<h2>{featuredTitle}</h2>
			<p>{featuredBody}</p>
		</div>
	</article>
	<div class="pair">
		{#each pair as item (item.title)}
			<article>
				<MediaPlaceholder label={item.imageLabel} ratio="16 / 10" />
				<div class="overlay">
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
		gap: 0.85rem;
		padding: 2rem 0;
	}

	.featured,
	.pair article {
		position: relative;
		overflow: hidden;
	}

	.overlay {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		display: grid;
		gap: 0.3rem;
		padding: 0.85rem;
		background: color-mix(in srgb, var(--paper) 78%, var(--ink));
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.2rem, 2.2vw, 1.5rem);
		font-weight: 500;
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

	.pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
	}

	@media (max-width: 640px) {
		.pair {
			grid-template-columns: 1fr;
		}
	}
</style>
