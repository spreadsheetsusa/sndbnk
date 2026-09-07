<script>
	/**
	 * @typedef {{ id: string, label: string, body: string }} ProofCell
	 */

	/**
	 * @type {{
	 *   cells: ProofCell[],
	 *   label?: string
	 * }}
	 */
	let { cells, label = 'Proof' } = $props();
</script>

<section class="proof" aria-label={label}>
	{#each cells as cell (cell.id)}
		<article class="cell">
			<p class="lcd-face label">{cell.label}</p>
			<p class="body">{cell.body}</p>
		</article>
	{/each}
</section>

<style>
	.proof {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		border: 1px solid var(--hard-border);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.cell {
		display: grid;
		gap: 0.55rem;
		padding: 1.1rem 1.15rem 1.2rem;
		background: var(--paper);
	}

	.cell + .cell {
		border-left: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}

	.label {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.body {
		margin: 0;
		font-size: 0.92rem;
		line-height: 1.45;
	}

	@media (max-width: 960px) {
		.proof {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.cell:nth-child(2n + 1) {
			border-left: 0;
		}

		.cell:nth-child(n + 3) {
			border-top: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		}
	}

	@media (max-width: 640px) {
		.proof {
			grid-template-columns: 1fr;
		}

		.cell + .cell {
			border-left: 0;
			border-top: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		}
	}
</style>
