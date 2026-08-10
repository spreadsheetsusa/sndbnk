<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   members?: Array<{ name: string, role: string }>
	 * }}
	 */
	let {
		heading = 'People behind the signal',
		members = [
			{ name: 'Ada Frequency', role: 'Founder · A&R' },
			{ name: 'Ben Waveform', role: 'Engineering' },
			{ name: 'Cleo Reverb', role: 'Community' },
			{ name: 'Dax Mono', role: 'Mix & master' },
			{ name: 'Eli Sub', role: 'Artist relations' },
			{ name: 'Faye Loop', role: 'Merch & drops' },
			{ name: 'Gio Tape', role: 'Podcast ops' },
			{ name: 'Hana Bass', role: 'Support' },
			{ name: 'Ivo Peak', role: 'Design' }
		]
	} = $props();
</script>

<section class="team">
	<h2>{heading}</h2>
	<div class="grid">
		{#each members as member (member.name)}
			<article>
				<span class="avatar" aria-hidden="true"></span>
				<div>
					<p class="name">{member.name}</p>
					<p class="role">{member.role}</p>
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
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		width: 100%;
		text-align: left;
	}

	@media (max-width: 800px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	article {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		padding: 0.65rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.avatar {
		flex-shrink: 0;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		background: color-mix(in srgb, var(--accent) 22%, var(--paper));
	}

	.name {
		margin: 0;
		font-size: 0.92rem;
		font-weight: 500;
	}

	.role {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.8rem;
		line-height: 1.35;
	}
</style>
