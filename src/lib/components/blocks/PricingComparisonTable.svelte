<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   plans?: Array<{ name: string }>,
	 *   rows?: Array<{ feature: string, values: string }>,
	 *   ctaLabel?: string,
	 *   ctaHref?: string
	 * }}
	 */
	let {
		heading = 'Compare hosting tiers',
		plans = [{ name: 'Free' }, { name: 'Vault' }, { name: 'Studio' }, { name: 'Label' }],
		rows = [
			{ feature: 'Published tracks', values: '15\nUnlimited\nUnlimited\nUnlimited' },
			{ feature: 'Hosted storage', values: '—\n50 GB\n200 GB\n1 TB' },
			{ feature: 'Subdomain', values: '—\n✓\n✓\n✓' },
			{ feature: 'Custom domain', values: '—\n—\n✓\n✓' },
			{ feature: 'Remove branding', values: '—\n—\n✓\n✓' }
		],
		ctaLabel = 'View plans',
		ctaHref = '/plans'
	} = $props();
</script>

<section class="pricing">
	<h2>{heading}</h2>
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th scope="col">Feature</th>
					{#each plans as plan (plan.name)}
						<th scope="col">{plan.name}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.feature)}
					<tr>
						<th scope="row">{row.feature}</th>
						{#each row.values.split('\n').filter(Boolean) as value, i (i)}
							<td>{value}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
</section>

<style>
	.pricing {
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
		max-width: 32ch;
	}

	.table-wrap {
		width: 100%;
		overflow-x: auto;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
		font-size: 0.88rem;
	}

	th,
	td {
		padding: 0.55rem 0.75rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
	}

	thead th {
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
		background: color-mix(in srgb, var(--ink) 4%, var(--paper));
	}

	tbody th {
		font-weight: 500;
		color: var(--ink);
	}

	tbody td {
		color: var(--muted);
		text-align: center;
	}

	tbody tr:last-child th,
	tbody tr:last-child td {
		border-bottom: 0;
	}

	.cta {
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.88rem;
	}
</style>
