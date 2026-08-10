<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   steps?: Array<{ title: string, body: string }>,
	 *   imageLabel?: string
	 * }}
	 */
	let {
		steps = [
			{ title: 'Sign up', body: 'Claim a username and land in the library.' },
			{ title: 'Upload', body: 'Drop your first track; waveforms generate in the background.' },
			{ title: 'Customize', body: 'Set accent, header, and blocks in the site builder.' },
			{ title: 'Launch', body: 'Point a domain and share the player with the world.' }
		],
		imageLabel = 'Onboarding'
	} = $props();
</script>

<section class="content">
	<ol class="timeline">
		{#each steps as step (step.title)}
			<li>
				<span class="icon" aria-hidden="true"></span>
				<div>
					<h3>{step.title}</h3>
					<p>{step.body}</p>
				</div>
			</li>
		{/each}
	</ol>
	<div class="media">
		<MediaPlaceholder label={imageLabel} ratio="4 / 5" />
	</div>
</section>

<style>
	.content {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: 1.5rem;
		padding: 2rem 0;
	}

	@media (max-width: 800px) {
		.content {
			grid-template-columns: 1fr;
		}
	}

	.timeline {
		margin: 0;
		padding: 0 0 0 0.25rem;
		list-style: none;
		display: grid;
		gap: 0;
	}

	li {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.85rem;
		align-items: start;
		padding: 0 0 1.1rem 0;
		position: relative;
	}

	li:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 0.65rem;
		top: 1.75rem;
		bottom: 0;
		width: 1px;
		background: color-mix(in srgb, var(--ink) 22%, transparent);
	}

	.icon {
		width: 1.35rem;
		height: 1.35rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
		z-index: 1;
	}

	h3 {
		margin: 0;
		font-size: 0.98rem;
		font-weight: 500;
	}

	p {
		margin: 0.3rem 0 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.4;
	}
</style>
