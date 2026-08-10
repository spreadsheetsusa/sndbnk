<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   heading?: string,
	 *   members?: Array<{ name: string, body: string, imageLabel: string }>
	 * }}
	 */
	let {
		heading = 'Core crew',
		members = [
			{
				name: 'Ada Frequency',
				body: 'Sets the release calendar and keeps the vault organized.',
				imageLabel: 'Portrait'
			},
			{
				name: 'Ben Waveform',
				body: 'Builds the player, waveforms, and everything listeners touch.',
				imageLabel: 'Portrait'
			},
			{
				name: 'Cleo Reverb',
				body: 'Runs community drops, listening parties, and artist onboarding.',
				imageLabel: 'Portrait'
			},
			{
				name: 'Dax Mono',
				body: 'Final ears on club mixes before they hit the feed.',
				imageLabel: 'Portrait'
			}
		]
	} = $props();
</script>

<section class="team">
	<h2>{heading}</h2>
	<div class="grid">
		{#each members as member (member.name)}
			<article>
				<MediaPlaceholder label={member.imageLabel} ratio="1 / 1" />
				<div>
					<h3>{member.name}</h3>
					<p>{member.body}</p>
				</div>
			</article>
		{/each}
	</div>
</section>

<style>
	.team {
		display: grid;
		gap: 1.25rem;
		justify-items: center;
		padding: 2rem 0;
		text-align: center;
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.35rem, 2.4vw, 1.75rem);
		font-weight: 500;
		max-width: 28ch;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		width: 100%;
		text-align: left;
	}

	@media (max-width: 720px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	article {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		gap: 0.85rem;
		align-items: start;
	}

	@media (max-width: 480px) {
		article {
			grid-template-columns: 1fr;
		}
	}

	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 500;
	}

	p {
		margin: 0.35rem 0 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.45;
	}
</style>
