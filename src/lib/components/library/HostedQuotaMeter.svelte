<script>
	/**
	 * @type {{
	 *   localBytes: number,
	 *   maxLocalBytes: number | null,
	 *   planLabel: string
	 * }}
	 */
	let { localBytes, maxLocalBytes, planLabel } = $props();

	const atStorageCap = $derived(maxLocalBytes !== null && localBytes >= maxLocalBytes);
	const storageFill = $derived(
		maxLocalBytes ? Math.min(100, Math.round((localBytes / maxLocalBytes) * 100)) : 0
	);

	/**
	 * @param {number} value
	 */
	function bytes(value) {
		if (value < 1024) return `${value} B`;
		const units = ['KB', 'MB', 'GB', 'TB'];
		let n = value / 1024;
		let i = 0;
		while (n >= 1024 && i < units.length - 1) {
			n /= 1024;
			i += 1;
		}
		return `${n >= 10 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
	}
</script>

{#if maxLocalBytes !== null}
	{#if atStorageCap}
		<p class="quota-upsell">
			You've used the {bytes(maxLocalBytes)} of hosted storage on {planLabel}.
			<a href="/settings?tab=billing">Upgrade plan</a>
		</p>
	{:else}
		<div class="quota-meter" aria-label="Hosted storage quota">
			<div class="meter-head">
				<span class="meter-label">Hosted</span>
				<span class="meter-value">{bytes(localBytes)} / {bytes(maxLocalBytes)}</span>
			</div>
			<div
				class="meter-track"
				role="progressbar"
				aria-valuenow={localBytes}
				aria-valuemin="0"
				aria-valuemax={maxLocalBytes}
				aria-label="Hosted storage used"
			>
				<span class="meter-fill" style="width: {storageFill}%"></span>
			</div>
		</div>
	{/if}
{/if}

<style>
	.quota-meter {
		width: 100%;
		min-width: 9rem;
		max-width: 14rem;
		animation: rise 0.8s ease 0.08s both;
	}

	.meter-head {
		display: flex;
		gap: 1rem;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.35rem;
	}

	.meter-label {
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.meter-value {
		color: var(--muted);
		font-size: 0.78rem;
	}

	.meter-track {
		height: 0.55rem;
		border: 1px solid var(--ink);
		background: transparent;
	}

	.meter-fill {
		display: block;
		height: 100%;
		background: var(--accent);
	}

	.quota-upsell {
		max-width: 14rem;
		margin: 0;
		color: var(--muted);
		font-size: 0.78rem;
		line-height: 1.4;
		text-align: right;
		animation: rise 0.8s ease 0.08s both;
	}

	.quota-upsell a {
		color: var(--ink);
		font-weight: 700;
		text-underline-offset: 0.15em;
	}

	.quota-upsell a:hover {
		color: var(--accent);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.6rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
