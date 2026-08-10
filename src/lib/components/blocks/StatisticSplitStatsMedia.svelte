<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   heading?: string,
	 *   body?: string,
	 *   stats?: Array<{ value: string, label: string }>,
	 *   imageLabel?: string
	 * }}
	 */
	let {
		heading = 'Numbers that keep up with the catalog',
		body = 'From first upload to headline play counts, SNDBNK tracks what matters without slowing the player.',
		stats = [
			{ value: '15', label: 'Free tracks' },
			{ value: '60%', label: 'Play threshold' },
			{ value: '4', label: 'Media types' },
			{ value: '∞', label: 'Queue depth' }
		],
		imageLabel = 'Dashboard'
	} = $props();
</script>

<section class="content">
	<div class="copy">
		<h2>{heading}</h2>
		<p>{body}</p>
		<div class="stats">
			{#each stats as stat (stat.label)}
				<div class="stat">
					<p class="value">{stat.value}</p>
					<p class="label">{stat.label}</p>
				</div>
			{/each}
		</div>
	</div>
	<div class="media">
		<MediaPlaceholder label={imageLabel} ratio="5 / 4" />
	</div>
</section>

<style>
	.content {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: 1.5rem;
		align-items: center;
		padding: 2rem 0;
	}

	@media (max-width: 800px) {
		.content {
			grid-template-columns: 1fr;
		}
	}

	.copy {
		display: grid;
		gap: 0.85rem;
		align-content: start;
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.35rem, 2.4vw, 1.75rem);
		font-weight: 500;
	}

	.copy > p {
		margin: 0;
		color: var(--muted);
		line-height: 1.45;
		max-width: 38ch;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 0.35rem;
	}

	.stat {
		display: grid;
		gap: 0.15rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.value {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: 1.25rem;
		font-weight: 500;
		line-height: 1.1;
	}

	.label {
		margin: 0;
		color: var(--muted);
		font-size: 0.78rem;
	}
</style>
