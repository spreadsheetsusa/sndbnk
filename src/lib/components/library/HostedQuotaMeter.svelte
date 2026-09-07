<script>
	import {
		VAULT_CHECKOUT_HREF,
		isAtTrackCap,
		isNearTrackCap,
		upgradeHrefForQuota
	} from '#lib/billing/ladder.js';

	/**
	 * @type {{
	 *   localBytes?: number,
	 *   maxLocalBytes?: number | null,
	 *   trackCount?: number,
	 *   maxTracks?: number | null,
	 *   planLabel: string,
	 *   label?: string
	 * }}
	 */
	let {
		localBytes = 0,
		maxLocalBytes = null,
		trackCount = 0,
		maxTracks = null,
		planLabel,
		label = 'Hosted'
	} = $props();

	const meterLabel = $derived(label.trim() || 'Hosted');
	const showTracks = $derived(maxTracks !== null);
	const showBytes = $derived(maxLocalBytes !== null);
	const atTrackCap = $derived(isAtTrackCap(trackCount, maxTracks));
	const nearTrackCap = $derived(isNearTrackCap(trackCount, maxTracks));
	const atStorageCap = $derived(maxLocalBytes !== null && localBytes >= maxLocalBytes);
	const tracksLeft = $derived(maxTracks != null ? Math.max(0, maxTracks - trackCount) : 0);
	const trackUpgradeHref = $derived(
		upgradeHrefForQuota({ trackCount, maxTracks, localBytes, maxLocalBytes })
	);
	const trackFill = $derived(
		maxTracks ? Math.min(100, Math.round((trackCount / maxTracks) * 100)) : 0
	);
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

{#if showTracks || showBytes}
	{#if showTracks}
		<div
			class="quota-meter"
			class:warn={nearTrackCap}
			class:capped={atTrackCap}
			aria-label="Track quota"
		>
			<div class="meter-head">
				<span class="meter-label">Tracks</span>
				<span class="meter-value">{trackCount} / {maxTracks}</span>
			</div>
			<div
				class="meter-track"
				role="progressbar"
				aria-valuenow={trackCount}
				aria-valuemin="0"
				aria-valuemax={maxTracks}
				aria-label="Tracks used"
			>
				<span class="meter-fill" style="width: {trackFill}%"></span>
			</div>
			{#if atTrackCap}
				<p class="quota-upsell">
					Album's full on {planLabel}.
					<a href={VAULT_CHECKOUT_HREF}>Get Vault</a>
				</p>
			{:else if nearTrackCap}
				<p class="quota-upsell">
					{tracksLeft} left on this album.
					<a href={trackUpgradeHref}>Get Vault</a>
				</p>
			{/if}
		</div>
	{:else if atStorageCap}
		<p class="quota-upsell">
			You've used the {bytes(maxLocalBytes ?? 0)} of hosted storage on {planLabel}.
			<a href="/plans">See plans</a>
		</p>
	{:else}
		<div class="quota-meter" aria-label="{meterLabel} storage quota">
			<div class="meter-head">
				<span class="meter-label" title={meterLabel}>{meterLabel}</span>
				<span class="meter-value">{bytes(localBytes)} / {bytes(maxLocalBytes ?? 0)}</span>
			</div>
			<div
				class="meter-track"
				role="progressbar"
				aria-valuenow={localBytes}
				aria-valuemin="0"
				aria-valuemax={maxLocalBytes}
				aria-label="{meterLabel} storage used"
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
		min-width: 0;
		margin-bottom: 0.35rem;
	}

	.meter-label {
		min-width: 0;
		overflow: hidden;
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.meter-value {
		flex-shrink: 0;
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

	.quota-meter.warn .meter-fill,
	.quota-meter.capped .meter-fill {
		background: color-mix(in srgb, var(--accent) 72%, var(--ink));
	}

	.quota-upsell {
		max-width: 14rem;
		margin: 0.35rem 0 0;
		color: var(--muted);
		font-size: 0.78rem;
		line-height: 1.4;
		text-align: right;
		animation: rise 0.8s ease 0.08s both;
	}

	.quota-meter .quota-upsell {
		max-width: none;
		text-align: left;
		animation: none;
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
