<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   heading?: string,
	 *   members?: Array<{ name: string, bio: string, imageLabel: string }>
	 * }}
	 */
	let {
		heading = 'Artists & operators',
		members = [
			{
				name: 'Ada Frequency',
				bio: 'Techno producer steering the label roster.',
				imageLabel: 'Portrait'
			},
			{
				name: 'Ben Waveform',
				bio: 'Full-stack builder obsessed with clean playback.',
				imageLabel: 'Portrait'
			},
			{
				name: 'Cleo Reverb',
				bio: 'Community lead for drops and live listening rooms.',
				imageLabel: 'Portrait'
			},
			{
				name: 'Dax Mono',
				bio: 'Mix engineer for long-form club sets.',
				imageLabel: 'Portrait'
			},
			{
				name: 'Eli Sub',
				bio: 'Artist relations across subdomains and custom domains.',
				imageLabel: 'Portrait'
			},
			{
				name: 'Faye Loop',
				bio: 'Merch drops tied to sample packs and tour dates.',
				imageLabel: 'Portrait'
			},
			{
				name: 'Gio Tape',
				bio: 'Podcast ops and episode metadata.',
				imageLabel: 'Portrait'
			},
			{
				name: 'Hana Bass',
				bio: 'Listener support and billing questions.',
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
				<MediaPlaceholder label={member.imageLabel} ratio="3 / 4" />
				<h3>{member.name}</h3>
				<p>{member.bio}</p>
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
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.85rem;
		width: 100%;
		text-align: left;
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 480px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	article {
		display: grid;
		gap: 0.4rem;
		align-content: start;
	}

	h3 {
		margin: 0.15rem 0 0;
		font-size: 0.95rem;
		font-weight: 500;
	}

	p {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
		line-height: 1.4;
	}
</style>
