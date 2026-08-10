<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   quotes?: Array<{ quote: string, name: string, role: string }>
	 * }}
	 */
	let {
		heading = 'What artists say',
		quotes = [
			{
				quote:
					'Uploads land fast, waveforms look right, and my profile finally feels like my catalog.',
				name: 'Kira Vox',
				role: 'Producer · London'
			},
			{
				quote:
					'Custom domain plus a player that survives navigation — that is the whole pitch for me.',
				name: 'Mono Lake',
				role: 'DJ · Chicago'
			}
		]
	} = $props();
</script>

<section class="content">
	<h2>{heading}</h2>
	<div class="grid">
		{#each quotes as item (item.name)}
			<blockquote>
				<p>&ldquo;{item.quote}&rdquo;</p>
				<footer>
					<span class="avatar" aria-hidden="true"></span>
					<div>
						<p class="name">{item.name}</p>
						<p class="role">{item.role}</p>
					</div>
				</footer>
			</blockquote>
		{/each}
	</div>
</section>

<style>
	.content {
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

	blockquote {
		margin: 0;
		display: grid;
		gap: 0.85rem;
		padding: 1rem;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		background: color-mix(in srgb, var(--ink) 4%, var(--paper));
	}

	blockquote > p {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	footer {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.avatar {
		width: 2.25rem;
		height: 2.25rem;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		border-radius: 50%;
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
		flex-shrink: 0;
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
