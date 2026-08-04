<script>
	import IconHeadphones from '@tabler/icons-svelte-runes/icons/headphones';
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconMessageCircle from '@tabler/icons-svelte-runes/icons/message-circle';

	import CoverArt from '#lib/components/CoverArt.svelte';
	import { formatDuration } from '#lib/media/audio-metadata.js';
	import { relativeTime } from '#lib/relative-time.js';

	/**
	 * @type {{
	 *   trackId: string,
	 *   hasCover?: boolean,
	 *   mediaType?: string | null,
	 *   genre?: string | null,
	 *   album?: string | null,
	 *   year?: number | null,
	 *   trackNumber?: number | null,
	 *   bpm?: number | null,
	 *   isrc?: string | null,
	 *   durationMs?: number | null,
	 *   bitrate?: number | null,
	 *   sampleRate?: number | null,
	 *   channels?: number | null,
	 *   codec?: string | null,
	 *   playCount?: number,
	 *   likeCount?: number,
	 *   commentCount?: number,
	 *   createdAt?: number | null
	 * }}
	 */
	let {
		trackId,
		hasCover = false,
		mediaType = null,
		genre = null,
		album = null,
		year = null,
		trackNumber = null,
		bpm = null,
		isrc = null,
		durationMs = null,
		bitrate = null,
		sampleRate = null,
		channels = null,
		codec = null,
		playCount = 0,
		likeCount = 0,
		commentCount = 0,
		createdAt = null
	} = $props();

	const uid = $props.id();
	const status = $derived((mediaType ?? '').trim().toUpperCase() || 'READY');

	const techSummary = $derived.by(() => {
		/** @type {string[]} */
		const parts = [];
		if (durationMs != null) parts.push(formatDuration(Number(durationMs)));
		if (codec) parts.push(codec);
		if (bitrate) {
			const kbps = Math.round(Number(bitrate) / 1000);
			if (Number.isFinite(kbps) && kbps > 0) parts.push(`${kbps} kbps`);
		}
		if (sampleRate) {
			const khz = Number(sampleRate) / 1000;
			if (Number.isFinite(khz) && khz > 0) parts.push(`${khz} kHz`);
		}
		if (channels) {
			const ch = Number(channels);
			parts.push(ch === 1 ? 'mono' : ch === 2 ? 'stereo' : `${ch} ch`);
		}
		return parts.length ? parts.join(' · ') : null;
	});

	const uploadedLabel = $derived(
		createdAt != null && Number.isFinite(createdAt) ? relativeTime(createdAt) : null
	);

	const signalFields = $derived.by(() => {
		/** @type {{ label: string, value: string }[]} */
		const fields = [];
		if (genre) fields.push({ label: 'Genre', value: String(genre) });
		if (mediaType) fields.push({ label: 'Type', value: String(mediaType) });
		return fields;
	});

	const tagFields = $derived.by(() => {
		/** @type {{ label: string, value: string }[]} */
		const fields = [];
		if (album) fields.push({ label: 'Album', value: String(album) });
		if (year != null) fields.push({ label: 'Year', value: String(year) });
		if (trackNumber != null) fields.push({ label: 'Track', value: String(trackNumber) });
		if (bpm != null) fields.push({ label: 'BPM', value: String(bpm) });
		if (isrc) fields.push({ label: 'ISRC', value: String(isrc) });
		return fields;
	});
</script>

<aside class="console" aria-label="Track info">
	<div class="console-chrome">
		<div class="chrome-leds" aria-hidden="true">
			<span class="led on accent"></span>
			<span class="led"></span>
			<span class="led"></span>
		</div>
		<p class="chrome-title">
			<span class="chrome-mark">INFO</span>
			<span class="chrome-sub">track signal</span>
		</p>
		<p class="chrome-status" data-status={status}>{status}</p>
	</div>

	<div class="console-body">
		<div class="signal-row" class:has-cover={hasCover}>
			<div class="lcd">
				<div class="eq" aria-hidden="true">
					<span style="--h: 28%"></span>
					<span style="--h: 55%"></span>
					<span style="--h: 40%"></span>
					<span style="--h: 72%"></span>
					<span style="--h: 48%"></span>
					<span style="--h: 63%"></span>
					<span style="--h: 35%"></span>
				</div>
				{#if techSummary}
					<p class="lcd-line">{techSummary}</p>
				{:else}
					<p class="lcd-line dim">NO SIGNAL</p>
				{/if}
				{#if uploadedLabel}
					<p class="lcd-line dim">UP {uploadedLabel}</p>
				{/if}
			</div>
			{#if hasCover}
				<CoverArt {trackId} hasCover class="cover" width="56" height="56" placeholder={false} />
			{/if}
		</div>

		<ul class="social" aria-label="Engagement">
			<li>
				<IconHeadphones size={12} stroke={1.75} aria-hidden="true" />
				<span>{playCount}</span>
			</li>
			<li>
				<IconHeart size={12} stroke={1.75} aria-hidden="true" />
				<span>{likeCount}</span>
			</li>
			<li>
				<IconMessageCircle size={12} stroke={1.75} aria-hidden="true" />
				<span>{commentCount}</span>
			</li>
		</ul>

		{#if signalFields.length}
			<section class="section" aria-labelledby="{uid}-signal">
				<p class="section-label" id="{uid}-signal"><span>01</span> Signal</p>
				<dl class="kv">
					{#each signalFields as field (field.label)}
						<div class="kv-row">
							<dt>{field.label}</dt>
							<dd>{field.value}</dd>
						</div>
					{/each}
				</dl>
			</section>
		{/if}

		{#if tagFields.length}
			<section class="section" aria-labelledby="{uid}-tags">
				<p class="section-label" id="{uid}-tags"><span>02</span> Tags</p>
				<dl class="kv">
					{#each tagFields as field (field.label)}
						<div class="kv-row">
							<dt>{field.label}</dt>
							<dd>{field.value}</dd>
						</div>
					{/each}
				</dl>
			</section>
		{/if}
	</div>
</aside>

<style>
	.console {
		width: 100%;
		max-width: var(--site-sidebar-width);
		border: 1px solid var(--hard-border);
		border-radius: 0;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--accent) 10%, transparent) 0%,
				transparent 2.25rem
			),
			var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		color: var(--ink);
	}

	.console-chrome {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.55rem;
		align-items: center;
		padding: 0.4rem 0.65rem;
		border-bottom: 1px solid var(--ink);
		border-radius: 0;
		background: var(--inverse);
		color: var(--on-inverse);
	}

	.chrome-leds {
		display: flex;
		gap: 0.25rem;
	}

	.led {
		width: 0.4rem;
		height: 0.4rem;
		border: 1px solid color-mix(in srgb, var(--on-inverse) 35%, transparent);
		border-radius: 0;
		background: color-mix(in srgb, var(--on-inverse) 12%, transparent);
		opacity: 0.4;
	}

	.led.on {
		opacity: 1;
		background: color-mix(in srgb, var(--on-inverse) 55%, transparent);
		border-color: var(--on-inverse);
	}

	.led.accent.on {
		background: var(--accent);
		border-color: var(--accent);
		box-shadow: 0 0 0.4rem color-mix(in srgb, var(--accent) 70%, transparent);
	}

	.chrome-title {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.55rem;
		align-items: baseline;
		margin: 0;
		min-width: 0;
	}

	.chrome-mark {
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		color: var(--accent);
	}

	.chrome-sub {
		color: color-mix(in srgb, var(--on-inverse) 62%, transparent);
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.chrome-status {
		margin: 0;
		padding: 0.12rem 0.4rem;
		border: 1px solid var(--accent);
		border-radius: 0;
		background: var(--accent);
		color: var(--on-accent);
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		line-height: 1.2;
		max-width: 7rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.console-body {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 0.75rem;
		min-width: 0;
	}

	.signal-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.5rem;
		align-items: stretch;
		min-width: 0;
	}

	.signal-row.has-cover {
		grid-template-columns: minmax(0, 1fr) 3.5rem;
	}

	.signal-row :global(img.cover) {
		display: block;
		width: 3.5rem;
		height: 3.5rem;
		object-fit: cover;
		border: 1px solid var(--ink);
		border-radius: 0;
		box-shadow: 3px 3px 0 var(--cover-shadow);
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}

	.lcd {
		position: relative;
		display: grid;
		gap: 0.15rem;
		align-content: start;
		min-height: 3.5rem;
		padding: 0.45rem 0.55rem;
		overflow: hidden;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: var(--inverse);
		color: var(--on-inverse);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
	}

	.eq {
		position: absolute;
		right: 0.4rem;
		bottom: 0.35rem;
		display: flex;
		gap: 0.12rem;
		align-items: flex-end;
		height: 1.15rem;
		opacity: 0.55;
		pointer-events: none;
	}

	.eq span {
		display: block;
		width: 0.18rem;
		height: var(--h);
		border-radius: 0;
		background: var(--accent);
		transform-origin: bottom;
		animation: eq-bounce 1.1s ease-in-out infinite;
	}

	.eq span:nth-child(2n) {
		animation-delay: 0.1s;
	}
	.eq span:nth-child(3n) {
		animation-delay: 0.18s;
	}
	.eq span:nth-child(5n) {
		animation-delay: 0.06s;
	}

	.lcd-line {
		margin: 0;
		padding-right: 1.6rem;
		overflow: hidden;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		line-height: 1.35;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.lcd-line.dim {
		color: color-mix(in srgb, var(--on-inverse) 55%, transparent);
	}

	.social {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem 0.9rem;
		margin: 0;
		padding: 0;
		list-style: none;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.social li {
		display: inline-flex;
		gap: 0.28rem;
		align-items: center;
	}

	.social :global(svg) {
		color: var(--ink);
		opacity: 0.72;
	}

	.section {
		display: grid;
		gap: 0.4rem;
		min-width: 0;
	}

	.section-label {
		display: flex;
		gap: 0.45rem;
		align-items: baseline;
		margin: 0;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.section-label span {
		display: inline-grid;
		place-items: center;
		min-width: 1.3rem;
		padding: 0.06rem 0.28rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
	}

	.kv {
		display: grid;
		gap: 0.28rem;
		margin: 0;
	}

	.kv-row {
		display: grid;
		grid-template-columns: 4.25rem minmax(0, 1fr);
		gap: 0.4rem;
		align-items: baseline;
		min-width: 0;
	}

	.kv dt {
		margin: 0;
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.kv dd {
		margin: 0;
		overflow: hidden;
		font-size: 0.74rem;
		font-weight: 600;
		line-height: 1.3;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@keyframes eq-bounce {
		0%,
		100% {
			transform: scaleY(0.55);
		}
		50% {
			transform: scaleY(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.eq span {
			animation: none;
		}
	}
</style>
