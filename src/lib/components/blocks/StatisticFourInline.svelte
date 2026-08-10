<script>
	/**
	 * @type {{
	 *   stats?: Array<{ value: string, label: string }>
	 * }}
	 */
	let {
		stats = [
			{ value: '12K+', label: 'Tracks hosted' },
			{ value: '3.2M', label: 'Plays counted' },
			{ value: '840', label: 'Active artists' },
			{ value: '99.9%', label: 'Uptime' }
		]
	} = $props();
</script>

<section class="content">
	<div class="stats">
		{#each stats as stat (stat.label)}
			<div class="stat">
				<p class="value">{stat.value}</p>
				<p class="label">{stat.label}</p>
			</div>
		{/each}
	</div>
</section>

<style>
	.content {
		padding: 2rem 0;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1rem;
		text-align: center;
	}

	@media (max-width: 720px) {
		.stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.stat {
		display: grid;
		gap: 0.25rem;
	}

	.value {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.5rem, 3vw, 2rem);
		font-weight: 500;
		line-height: 1.1;
	}

	.label {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
