<script>
	import IconGripVertical from '@tabler/icons-svelte-runes/icons/grip-vertical';
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconHeartFilled from '@tabler/icons-svelte-runes/icons/heart-filled';
	import IconPlanet from '@tabler/icons-svelte-runes/icons/planet';
	import IconPlayerPauseFilled from '@tabler/icons-svelte-runes/icons/player-pause-filled';
	import IconPlayerPlayFilled from '@tabler/icons-svelte-runes/icons/player-play-filled';
	import IconPlayerSkipBackFilled from '@tabler/icons-svelte-runes/icons/player-skip-back-filled';
	import IconPlayerSkipForwardFilled from '@tabler/icons-svelte-runes/icons/player-skip-forward-filled';
	import IconX from '@tabler/icons-svelte-runes/icons/x';
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import CoverArt from '#lib/components/CoverArt.svelte';
	import MarqueeLine from '#lib/components/player/MarqueeLine.svelte';
	import Waveform from '#lib/components/player/Waveform.svelte';
	import { formatDuration } from '#lib/media/audio-metadata.js';
	import { player } from '#lib/player/player.svelte.js';
	import { visualizer } from '#lib/player/visualizer.svelte.js';

	/**
	 * @typedef {Object} TimedComment
	 * @property {string} id
	 * @property {string} body
	 * @property {number} atMs
	 * @property {number} createdAt
	 * @property {string} userId
	 * @property {string} userName
	 * @property {string | null} userImage
	 */

	const DRAG_THRESHOLD_PX = 6;

	const signedIn = $derived(Boolean(page.data.nav?.name));

	let queueOpen = $state(false);
	/** @type {HTMLButtonElement | null} */
	let queueBtn = $state(null);
	let likeBusy = $state(false);
	/** Waveform scrub preview in seconds. @type {number | null} */
	let scrubSeconds = $state(null);

	/** @type {TimedComment[]} */
	let timedComments = $state([]);
	/** @type {string | null} */
	let hoveredMarkerId = $state(null);

	/** @type {string | null} */
	let draggingId = $state(null);
	let dragMoved = false;
	/** @type {{ x: number, y: number } | null} */
	let dragOrigin = null;
	/** @type {HTMLElement | null} */
	let dragHandleEl = null;

	const displayTime = $derived(scrubSeconds ?? player.currentTime);
	const durationMs = $derived(player.current?.durationMs ?? Math.round(player.duration * 1000));
	const flipDuration = $derived(prefersReducedMotion.current ? 0 : 180);

	const bitrateLabel = $derived.by(() => {
		const bitrate = player.current?.bitrate;
		if (bitrate == null || bitrate <= 0) return null;
		const kbps = Math.round(bitrate / 1000);
		return Number.isFinite(kbps) && kbps > 0 ? `${kbps} KBPS` : null;
	});

	const sampleRateLabel = $derived.by(() => {
		const sampleRate = player.current?.sampleRate;
		if (sampleRate == null || sampleRate <= 0) return null;
		const khz = sampleRate / 1000;
		if (!Number.isFinite(khz) || khz <= 0) return null;
		const rounded = Number.isInteger(khz) ? String(khz) : khz.toFixed(1);
		return `${rounded} KHZ`;
	});

	const channelsLabel = $derived.by(() => {
		const channels = player.current?.channels;
		if (channels == null || channels <= 0) return null;
		if (channels === 1) return 'MONO';
		if (channels === 2) return 'STEREO';
		return `${channels} CH`;
	});

	const techTop = $derived.by(() => {
		if (bitrateLabel) return bitrateLabel;
		const codec = player.current?.codec?.trim();
		return codec ? codec.toUpperCase() : null;
	});
	const techBottom = $derived.by(() => {
		const parts = [channelsLabel, sampleRateLabel].filter(Boolean);
		return parts.length ? parts.join(' · ') : null;
	});
	const hasTechMeta = $derived(Boolean(techTop || techBottom));

	const markers = $derived.by(() => {
		if (durationMs <= 0) return [];
		return timedComments
			.slice()
			.sort((a, b) => a.atMs - b.atMs)
			.map((comment) => ({
				...comment,
				leftPct: Math.min(Math.max((comment.atMs / durationMs) * 100, 0), 100)
			}));
	});

	const activeMarker = $derived(markers.find((marker) => marker.id === hoveredMarkerId) ?? null);

	// Network fetch for avatar markers — not derivable from local state.
	$effect(() => {
		const trackId = player.current?.id ?? null;
		timedComments = [];
		if (!trackId) return;

		const controller = new AbortController();
		void (async () => {
			try {
				const res = await fetch(`/api/tracks/${trackId}/comments`, {
					signal: controller.signal
				});
				if (!res.ok) return;
				const data = await res.json();
				if (controller.signal.aborted || player.current?.id !== trackId) return;
				timedComments = Array.isArray(data.comments) ? data.comments : [];
			} catch {
				// AbortError or network blip — leave markers empty.
			}
		})();

		return () => controller.abort();
	});

	/** @param {number} seconds */
	function handleWaveSeek(seconds) {
		player.seek(seconds);
	}

	async function toggleLike() {
		const track = player.current;
		if (!track || likeBusy) return;
		likeBusy = true;
		try {
			const res = await fetch(`/api/tracks/${track.id}/like`, { method: 'POST' });
			if (res.ok) {
				const data = await res.json();
				player.setLiked(track.id, data.liked);
			}
		} finally {
			likeBusy = false;
		}
	}

	/**
	 * @param {PointerEvent} event
	 * @param {string} trackId
	 */
	function startQueueDrag(event, trackId) {
		if (event.button !== 0) return;
		event.preventDefault();
		draggingId = trackId;
		dragMoved = false;
		dragOrigin = { x: event.clientX, y: event.clientY };
		dragHandleEl = /** @type {HTMLElement} */ (event.currentTarget);
		dragHandleEl.setPointerCapture(event.pointerId);
	}

	/** @param {PointerEvent} event */
	function onQueueDragMove(event) {
		if (!draggingId || !dragOrigin) return;
		const dx = event.clientX - dragOrigin.x;
		const dy = event.clientY - dragOrigin.y;
		if (!dragMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
		dragMoved = true;

		const fromIndex = player.queue.findIndex((t) => t.id === draggingId);
		if (fromIndex < 0) return;

		const el = document.elementFromPoint(event.clientX, event.clientY);
		const row = el instanceof Element ? el.closest('li[data-queue-id]') : null;
		if (!row) return;
		const overId = row.getAttribute('data-queue-id');
		if (!overId || overId === draggingId) return;
		const toIndex = player.queue.findIndex((t) => t.id === overId);
		if (toIndex < 0) return;
		player.moveInQueue(fromIndex, toIndex);
	}

	/** @param {PointerEvent} event */
	function endQueueDrag(event) {
		if (!draggingId) return;
		if (dragHandleEl?.hasPointerCapture(event.pointerId)) {
			dragHandleEl.releasePointerCapture(event.pointerId);
		}
		const moved = dragMoved;
		draggingId = null;
		dragOrigin = null;
		dragHandleEl = null;
		dragMoved = false;
		// Browsers synthesize a click on whatever is under the pointer after pointerup.
		if (moved) {
			const swallow = (e) => {
				e.preventDefault();
				e.stopPropagation();
				cleanup();
			};
			const cleanup = () => {
				document.removeEventListener('click', swallow, true);
				clearTimeout(timer);
			};
			document.addEventListener('click', swallow, true);
			const timer = setTimeout(cleanup, 50);
		}
	}

	/** @param {string} trackId */
	function playQueuedById(trackId) {
		const index = player.queue.findIndex((t) => t.id === trackId);
		if (index < 0) return;
		player.playFromQueue(index);
	}

	/** @param {string} trackId */
	function removeQueuedById(trackId) {
		const index = player.queue.findIndex((t) => t.id === trackId);
		if (index < 0) return;
		player.removeFromQueue(index);
	}

	/** @param {KeyboardEvent} event */
	function handleQueueKeydown(event) {
		if (event.key !== 'Escape' || !queueOpen) return;
		queueOpen = false;
		queueBtn?.focus();
	}
</script>

<svelte:window onkeydown={handleQueueKeydown} />

{#if player.current}
	{@const track = player.current}
	{@const artistLabel = track.artist || track.uploaderName}
	<div class="header-player" role="region" aria-label="Now playing">
		<div class="strip">
			<div class="transport">
				<button
					type="button"
					class="cell transport-btn"
					aria-label="Previous"
					onclick={() => player.previous()}
				>
					<IconPlayerSkipBackFilled size={15} aria-hidden="true" />
				</button>
				<button
					type="button"
					class="cell transport-btn play"
					aria-label={player.playing ? 'Pause' : 'Play'}
					onclick={() => player.toggle()}
				>
					{#if player.playing}
						<IconPlayerPauseFilled size={17} aria-hidden="true" />
					{:else}
						<IconPlayerPlayFilled size={17} aria-hidden="true" />
					{/if}
				</button>
				<button
					type="button"
					class="cell transport-btn"
					aria-label="Next"
					disabled={player.queue.length === 0}
					onclick={() => player.next()}
				>
					<IconPlayerSkipForwardFilled size={15} aria-hidden="true" />
				</button>
			</div>

			<div class="cell now-playing" class:queue-open={queueOpen}>
				<div class="cover-wrap">
					<button
						type="button"
						class="bar-cover-btn"
						bind:this={queueBtn}
						class:active={queueOpen}
						aria-label="Next Up queue"
						aria-expanded={queueOpen}
						aria-controls="header-queue-panel"
						aria-haspopup="true"
						onclick={() => (queueOpen = !queueOpen)}
					>
						<CoverArt
							trackId={track.id}
							hasCover={track.hasCover}
							class="bar-cover"
							loading="eager"
							fetchpriority="high"
							width="32"
							height="32"
						/>
						{#if player.queue.length > 0}
							<span class="queue-count">{player.queue.length}</span>
						{/if}
					</button>

					{#if queueOpen}
						<aside class="queue-panel" id="header-queue-panel" aria-label="Next Up">
							<header>
								<span class="eyebrow">Next Up</span>
								{#if player.queue.length > 0}
									<button type="button" class="queue-clear" onclick={() => player.clearQueue()}>
										Clear
									</button>
								{/if}
							</header>
							{#if player.queue.length === 0}
								<p class="queue-empty">Nothing queued. Use “Add to Next Up” on any track.</p>
							{:else}
								<ol class:queue-dragging={draggingId != null}>
									{#each player.queue as queued (queued.id)}
										<li
											data-queue-id={queued.id}
											class:dragging={draggingId === queued.id}
											animate:flip={{ duration: flipDuration }}
										>
											<button
												type="button"
												class="queue-handle"
												aria-label="Reorder {queued.title}"
												onpointerdown={(e) => startQueueDrag(e, queued.id)}
												onpointermove={onQueueDragMove}
												onpointerup={endQueueDrag}
												onpointercancel={endQueueDrag}
											>
												<IconGripVertical size={15} stroke={1.75} aria-hidden="true" />
											</button>
											<button
												type="button"
												class="queue-track"
												onclick={() => playQueuedById(queued.id)}
											>
												<span class="queue-title">{queued.title}</span>
												<span class="queue-artist">{queued.artist || queued.uploaderName}</span>
											</button>
											<button
												type="button"
												class="queue-remove"
												aria-label="Remove {queued.title} from queue"
												onclick={() => removeQueuedById(queued.id)}
											>
												<IconX size={14} stroke={1.75} aria-hidden="true" />
											</button>
										</li>
									{/each}
								</ol>
							{/if}
						</aside>
					{/if}
				</div>

				<div class="now-body">
					<div class="now-meta desktop-meta">
						<MarqueeLine resetKey="{track.id}-artist">
							{#if track.username}
								<a class="now-artist" href="/users/{track.username}">{artistLabel}</a>
							{:else}
								<span class="now-artist">{artistLabel}</span>
							{/if}
						</MarqueeLine>
						<MarqueeLine resetKey="{track.id}-title">
							<a class="now-title" href="/tracks/{track.id}">{track.title}</a>
						</MarqueeLine>
					</div>

					<div class="now-meta mobile-meta">
						<MarqueeLine resetKey="{track.id}-combined">
							{#if track.username}
								<a class="now-artist" href="/users/{track.username}">{artistLabel}</a>
							{:else}
								<span class="now-artist">{artistLabel}</span>
							{/if}
							<span class="now-sep" aria-hidden="true"> — </span>
							<a class="now-title" href="/tracks/{track.id}">{track.title}</a>
						</MarqueeLine>
					</div>

					{#if hasTechMeta}
						<div class="now-tech">
							{#if techTop}<span class="tech-row">{techTop}</span>{/if}
							{#if techBottom}<span class="tech-row">{techBottom}</span>{/if}
						</div>
					{/if}
				</div>
			</div>

			<div class="cell scrub">
				<span class="time elapsed">{formatDuration(displayTime * 1000)}</span>

				<div class="wave-wrap">
					<Waveform
						peaks={track.waveform}
						{durationMs}
						currentTime={player.currentTime}
						label="Seek within {track.title}"
						onseek={handleWaveSeek}
						onscrub={(seconds) => (scrubSeconds = seconds)}
					/>
					{#each markers as marker (marker.id)}
						<button
							type="button"
							class="marker"
							class:active={activeMarker?.id === marker.id}
							style:left="{marker.leftPct}%"
							aria-label="{marker.userName} commented at {formatDuration(
								marker.atMs
							)}: {marker.body}"
							onmouseenter={() => (hoveredMarkerId = marker.id)}
							onmouseleave={() => (hoveredMarkerId = null)}
							onfocus={() => (hoveredMarkerId = marker.id)}
							onblur={() => (hoveredMarkerId = null)}
						>
							<Avatar src={marker.userImage} name={marker.userName} size="1rem" />
						</button>
					{/each}
					{#if activeMarker}
						<div
							class="marker-tip"
							style:left="min(max({activeMarker.leftPct}%, 4rem), calc(100% - 4rem))"
							transition:fade={{ duration: 120 }}
						>
							<span class="tip-name">{activeMarker.userName}</span>
							<span class="tip-body">{activeMarker.body}</span>
						</div>
					{/if}
				</div>

				<span class="time total">{formatDuration(player.duration * 1000)}</span>
			</div>

			{#if signedIn || visualizer.supported}
				<div class="bar-actions">
					{#if signedIn}
						<button
							type="button"
							class="cell icon-btn"
							class:active={track.likedByViewer}
							aria-label={track.likedByViewer ? 'Unlike' : 'Like'}
							aria-pressed={track.likedByViewer}
							onclick={toggleLike}
						>
							{#if track.likedByViewer}
								<IconHeartFilled size={15} aria-hidden="true" />
							{:else}
								<IconHeart size={15} stroke={1.75} aria-hidden="true" />
							{/if}
						</button>
					{/if}
					{#if visualizer.supported}
						<button
							type="button"
							class="cell icon-btn"
							class:active={visualizer.enabled}
							aria-label={visualizer.enabled ? 'Hide visualizer' : 'Show visualizer'}
							aria-pressed={visualizer.enabled}
							onclick={() => visualizer.toggle()}
						>
							<IconPlanet size={15} stroke={1.75} aria-hidden="true" />
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.header-player {
		/* Compact scrub wave that fits inside the shared chrome cell height. */
		--waveform-height: 1.75rem;
		position: relative;
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
		max-width: 100%;
		justify-content: center;
		overflow: visible;
	}

	.strip {
		--player-radius: 0.125rem;
		display: flex;
		align-items: stretch;
		/* Wider than content-sized, but leave breathing room beside logo/nav. */
		width: min(100%, 47.75rem);
		min-width: 0;
		overflow: visible;
		border: 1px solid var(--hard-border);
		border-radius: var(--player-radius);
		background: var(--paper);
		box-shadow: 3px 3px 0 var(--hard-shadow);
	}

	/* Round only outer corners of edge cells so fills follow the strip radius
	   without overflow:hidden on .strip (queue badge / marker tips must escape). */
	.transport .cell:first-child {
		border-top-left-radius: var(--player-radius);
		border-bottom-left-radius: var(--player-radius);
	}

	.transport,
	.bar-actions {
		display: flex;
		align-items: stretch;
		flex-shrink: 0;
	}

	.bar-actions {
		position: relative;
		z-index: 2;
		overflow: visible;
	}

	.cell {
		display: flex;
		align-items: center;
		height: var(--header-chrome-height);
		min-height: var(--header-chrome-height);
		border: 0;
		border-right: 1px solid var(--hard-border);
		overflow: hidden;
	}

	.bar-actions .cell:last-child {
		border-right: 0;
		border-top-right-radius: var(--player-radius);
		border-bottom-right-radius: var(--player-radius);
	}

	/* When no like/viz actions remain, scrub is the rightmost cell. */
	.strip:not(:has(.bar-actions)) .scrub {
		border-right: 0;
		border-top-right-radius: var(--player-radius);
		border-bottom-right-radius: var(--player-radius);
	}

	.transport-btn,
	.icon-btn {
		justify-content: center;
		width: 2.1rem;
		padding: 0;
		color: var(--ink);
		background: color-mix(in srgb, var(--paper) 88%, var(--ink));
		cursor: pointer;
		transition:
			background 120ms ease,
			color 120ms ease;
	}

	.transport-btn :global(svg),
	.icon-btn :global(svg) {
		display: block;
	}

	.transport-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.transport-btn.play {
		width: 2.4rem;
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: inset 2px 2px 0 color-mix(in srgb, var(--ink) 35%, transparent);
	}

	.transport-btn:not(:disabled):hover,
	.icon-btn:hover,
	.icon-btn.active {
		color: var(--on-accent);
		background: var(--accent);
	}

	.scrub {
		gap: 0.5rem;
		flex: 1 1 12rem;
		min-width: 8rem;
		max-width: 100%;
		padding: 0 0.6rem;
	}

	.wave-wrap {
		position: relative;
		display: grid;
		flex: 1;
		align-items: center;
		min-width: 0;
		max-width: 100%;
		min-height: var(--waveform-height);
		overflow: hidden;
	}

	.marker {
		position: absolute;
		top: 50%;
		z-index: 3;
		display: inline-flex;
		padding: 0;
		border: 0;
		background: transparent;
		transform: translate(-50%, -50%);
		cursor: default;
		--avatar-border: 1px solid var(--paper);
		--avatar-font-size: 0.5rem;
	}

	.marker:hover,
	.marker.active {
		transform: translate(-50%, -50%) scale(1.15);
		--avatar-border: 1px solid var(--ink);
	}

	.marker-tip {
		position: absolute;
		top: calc(50% + 1rem);
		z-index: 4;
		display: flex;
		max-width: min(14rem, 90%);
		gap: 0.3rem;
		align-items: baseline;
		padding: 0.18rem 0.45rem;
		border-radius: 999px;
		background: var(--inverse);
		color: var(--on-inverse);
		font-size: 0.62rem;
		line-height: 1.35;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.tip-name {
		font-weight: 900;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.tip-body {
		overflow: hidden;
		color: color-mix(in srgb, var(--on-inverse) 80%, transparent);
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.time {
		flex-shrink: 0;
		font-size: 0.66rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.03em;
	}

	.time.elapsed {
		color: var(--accent);
		filter: contrast(1.2);
	}

	.time.total {
		color: var(--muted);
	}

	.now-playing {
		gap: 0;
		/* Cover (~2.25rem) + title room; shrink only after scrub has given ground. */
		flex: 0 1 16rem;
		min-width: 9.5rem;
		max-width: 20rem;
		padding: 0;
		/* Visible so the queue badge can escape; clip spill inside .now-body. */
		overflow: visible;
		font-family: 'Bitcount Prop Single', ui-monospace, monospace;
		/* Query this cell (not .strip) so layout containment can't clip .queue-count. */
		container-type: inline-size;
		/* Soft glass LCD: top catch-light, mid wash, bottom shade — no scanlines. */
		--lcd-tint: color-mix(in srgb, var(--accent) 42%, var(--ink));
		background:
			radial-gradient(
				120% 90% at 50% -20%,
				color-mix(in srgb, var(--lcd-tint) 16%, transparent) 0%,
				transparent 55%
			),
			linear-gradient(
				165deg,
				color-mix(in srgb, var(--lcd-tint) 14%, var(--paper)) 0%,
				color-mix(in srgb, var(--lcd-tint) 5%, var(--paper)) 42%,
				color-mix(in srgb, var(--lcd-tint) 7%, var(--paper)) 72%,
				color-mix(in srgb, var(--lcd-tint) 12%, var(--paper)) 100%
			);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, var(--lcd-tint) 22%, transparent),
			inset 0 -1px 0 color-mix(in srgb, var(--ink) 6%, transparent),
			inset 0 0 1.1rem color-mix(in srgb, var(--lcd-tint) 9%, transparent);
	}

	.now-playing.queue-open {
		z-index: 30;
	}

	.cover-wrap {
		position: relative;
		flex-shrink: 0;
		overflow: visible;
		z-index: 1;
	}

	.now-playing.queue-open .cover-wrap {
		z-index: 50;
	}

	:global(.dark) .now-playing {
		--lcd-tint: color-mix(in srgb, var(--accent) 48%, var(--ink));
		background:
			radial-gradient(
				120% 90% at 50% -20%,
				color-mix(in srgb, var(--lcd-tint) 22%, transparent) 0%,
				transparent 55%
			),
			linear-gradient(
				165deg,
				color-mix(in srgb, var(--lcd-tint) 18%, var(--paper)) 0%,
				color-mix(in srgb, var(--lcd-tint) 8%, var(--paper)) 42%,
				color-mix(in srgb, var(--lcd-tint) 11%, var(--paper)) 72%,
				color-mix(in srgb, var(--lcd-tint) 16%, var(--paper)) 100%
			);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, var(--lcd-tint) 28%, transparent),
			inset 0 -1px 0 color-mix(in srgb, var(--ink) 18%, transparent),
			inset 0 0 1.25rem color-mix(in srgb, var(--lcd-tint) 14%, transparent);
	}

	.bar-cover-btn {
		position: relative;
		display: block;
		width: var(--header-chrome-height);
		height: var(--header-chrome-height);
		padding: 0;
		border: 0;
		border-right: 1px solid
			color-mix(in srgb, var(--lcd-tint, var(--accent)) 18%, var(--hard-border));
		border-radius: 0;
		background: transparent;
		cursor: pointer;
		overflow: visible;
		flex-shrink: 0;
	}

	.bar-cover-btn.active {
		/* Subtle accent cue — keep artwork visible. */
		box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 70%, transparent);
	}

	.bar-cover-btn :global(img.bar-cover),
	.bar-cover-btn :global(span.bar-cover.placeholder) {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
		border-radius: 0;
		box-shadow: none;
		object-fit: cover;
		pointer-events: none;
	}

	.bar-cover-btn :global(span.bar-cover.placeholder) {
		background:
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--lcd-tint, var(--accent)) 8%, transparent) 25%,
				transparent 25%
			),
			color-mix(in srgb, var(--lcd-tint, var(--accent)) 6%, var(--paper));
		background-size: 8px 8px;
	}

	.now-body {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.55rem;
		min-width: 0;
		flex: 1;
		padding: 0 0.1rem 0 0.45rem;
		/* Keep bitrate/stereo from painting over the adjacent waveform. */
		overflow: hidden;
	}

	.now-meta {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.05rem;
		min-width: 0;
		flex: 1;
		text-align: left;
		/* Match child type so MarqueeLine line-boxes fit the chrome height. */
		font-size: 0.7rem;
		line-height: 1.15;
	}

	.mobile-meta {
		display: none;
	}

	.now-tech {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-end;
		gap: 0.05rem;
		flex-shrink: 0;
		color: color-mix(in srgb, var(--accent) 68%, var(--muted));
		font-size: 0.55rem;
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
		line-height: 1.15;
		text-align: right;
		text-transform: uppercase;
		white-space: nowrap;
		text-shadow:
			0 0 0.35em color-mix(in srgb, var(--accent) 50%, transparent),
			0 0 0.8em color-mix(in srgb, var(--accent) 22%, transparent);
	}

	:global(.dark) .now-tech {
		color: color-mix(in srgb, var(--accent) 78%, var(--muted));
		text-shadow:
			0 0 0.4em color-mix(in srgb, var(--accent) 58%, transparent),
			0 0 0.95em color-mix(in srgb, var(--accent) 30%, transparent);
	}

	.now-artist {
		color: color-mix(in srgb, var(--lcd-tint, var(--accent)) 35%, var(--muted));
		font-size: 0.6rem;
		font-weight: 400;
		letter-spacing: 0.01em;
		text-decoration: none;
		white-space: nowrap;
	}

	.now-title {
		color: color-mix(in srgb, var(--lcd-tint, var(--accent)) 28%, var(--ink));
		font-size: 0.7rem;
		font-weight: 400;
		letter-spacing: 0;
		text-decoration: none;
		white-space: nowrap;
	}

	.now-sep {
		color: color-mix(in srgb, var(--lcd-tint, var(--accent)) 30%, var(--muted));
		font-size: 0.65rem;
		font-weight: 400;
	}

	.now-artist:hover,
	.now-title:hover {
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.icon-btn {
		position: relative;
	}

	.queue-count {
		position: absolute;
		z-index: 50;
		top: -0.4rem;
		right: -0.4rem;
		min-width: 1rem;
		padding: 0.05rem 0.2rem;
		border: 1px solid var(--ink);
		background: var(--accent);
		color: var(--on-accent);
		font-size: 0.58rem;
		font-weight: 900;
		line-height: 1.2;
		text-align: center;
	}

	.queue-panel {
		position: absolute;
		z-index: 20;
		top: calc(100% + 0.5rem);
		left: 0;
		width: min(22rem, calc(100vw - 2 * var(--site-shell-pad-x)));
		max-height: 60vh;
		padding: 0.85rem;
		overflow: auto;
		border: 1px solid var(--hard-border);
		border-radius: 0.125rem;
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.queue-panel header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.6rem;
	}

	.queue-clear {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-decoration: underline;
		text-transform: uppercase;
		text-underline-offset: 0.25em;
		cursor: pointer;
	}

	.queue-empty {
		margin: 0;
		color: var(--muted);
		font-size: 0.8rem;
		line-height: 1.5;
	}

	.queue-panel ol {
		display: grid;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.queue-panel li {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}

	.queue-panel li.dragging {
		background: color-mix(in srgb, var(--ink) 7%, transparent);
	}

	.queue-panel ol.queue-dragging {
		user-select: none;
	}

	.queue-handle {
		display: inline-flex;
		width: 1.6rem;
		height: 1.6rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 0;
		color: var(--muted);
		background: transparent;
		cursor: grab;
		touch-action: none;
		user-select: none;
		flex-shrink: 0;
	}

	.queue-handle :global(svg) {
		display: block;
	}

	.queue-handle:hover {
		color: var(--ink);
	}

	.queue-panel li.dragging .queue-handle {
		cursor: grabbing;
		color: var(--ink);
	}

	.queue-track {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.05rem;
		min-width: 0;
		padding: 0.4rem 0.5rem;
		border: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}

	.queue-track:hover {
		background: color-mix(in srgb, var(--ink) 7%, transparent);
	}

	.queue-title {
		overflow: hidden;
		color: var(--ink);
		font-size: 0.8rem;
		font-weight: 800;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.queue-artist {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.7rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.queue-remove {
		display: inline-flex;
		width: 1.6rem;
		height: 1.6rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		color: var(--muted);
		background: transparent;
		cursor: pointer;
		flex-shrink: 0;
	}

	.queue-remove :global(svg) {
		display: block;
	}

	.queue-remove:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	/* Matches the header's wrap breakpoint: full-width stacked player. */
	@media (max-width: 960px) {
		.header-player {
			order: 2;
			flex-basis: 100%;
			margin-bottom: 0.75rem;
		}

		.strip {
			display: grid;
			grid-template-columns: auto 1fr auto;
			grid-template-areas:
				'meta meta actions'
				'transport scrub scrub';
			width: 100%;
			align-items: stretch;
		}

		.strip:not(:has(.bar-actions)) {
			grid-template-columns: auto 1fr;
			grid-template-areas:
				'meta meta'
				'transport scrub';
		}

		.now-playing {
			grid-area: meta;
			flex: none;
			min-width: 0;
			max-width: none;
			min-height: 2.1rem;
			padding: 0;
			border-right: 0;
			border-bottom: 1px solid var(--hard-border);
			border-top-left-radius: var(--player-radius);
		}

		.strip:not(:has(.bar-actions)) .now-playing {
			border-top-right-radius: var(--player-radius);
			border-bottom-right-radius: 0;
		}

		/* Undo desktop “scrub is rightmost” radii — top-right stays on meta. */
		.strip:not(:has(.bar-actions)) .scrub {
			border-top-right-radius: 0;
			border-bottom-right-radius: var(--player-radius);
		}

		.now-body {
			padding: 0 0.45rem 0 0.5rem;
		}

		.bar-actions {
			grid-area: actions;
			border-bottom: 1px solid var(--hard-border);
		}

		.bar-actions .cell:first-child {
			border-left: 1px solid var(--hard-border);
		}

		/* Two-row grid: reset desktop side radii; corners are TL meta, TR actions, BL transport, BR scrub. */
		.transport .cell:first-child {
			border-top-left-radius: 0;
			border-bottom-left-radius: var(--player-radius);
		}

		.bar-actions .cell:last-child {
			border-top-right-radius: var(--player-radius);
			border-bottom-right-radius: 0;
		}

		.transport {
			grid-area: transport;
		}

		.transport .cell:last-child {
			border-right: 1px solid var(--hard-border);
		}

		.scrub {
			grid-area: scrub;
			flex: 1 1 auto;
			min-width: 0;
			padding: 0 0.5rem;
			border-right: 0;
			border-bottom-right-radius: var(--player-radius);
		}

		.desktop-meta {
			display: none;
		}

		.mobile-meta {
			display: flex;
			flex-direction: row;
			align-items: center;
		}

		.bar-cover-btn {
			width: 2.1rem;
			height: 2.1rem;
			border-top-left-radius: var(--player-radius);
		}

		.bar-cover-btn :global(img.bar-cover),
		.bar-cover-btn :global(span.bar-cover.placeholder) {
			border-top-left-radius: var(--player-radius);
		}

		.now-artist,
		.now-title {
			font-size: 0.72rem;
		}

		.now-artist {
			font-weight: 700;
		}

		.now-title {
			font-weight: 800;
		}

		.now-tech {
			font-size: 0.52rem;
		}
	}

	/* Drop KBPS / STEREO / KHZ first when the LCD cell is squeezed (before title collapses). */
	@container (max-width: 14.5rem) {
		.now-tech {
			display: none;
		}
	}

	@media (pointer: coarse) {
		.header-player {
			--waveform-height: calc(var(--tap-min) - 0.5rem);
		}

		.cell {
			height: var(--tap-min);
			min-height: var(--tap-min);
		}

		.transport-btn,
		.icon-btn {
			width: var(--tap-min);
		}

		.transport-btn.play {
			width: 3.25rem;
		}

		.queue-handle,
		.queue-remove {
			width: var(--tap-min);
			height: var(--tap-min);
		}

		.bar-cover-btn {
			width: var(--tap-min);
			height: var(--tap-min);
		}

		.now-playing,
		.scrub {
			height: var(--tap-min);
			min-height: var(--tap-min);
		}

		.wave-wrap {
			min-height: var(--waveform-height);
		}
	}
</style>
