<script>
	import IconChevronLeft from '@tabler/icons-svelte-runes/icons/chevron-left';
	import IconChevronRight from '@tabler/icons-svelte-runes/icons/chevron-right';
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconPlayerPauseFilled from '@tabler/icons-svelte-runes/icons/player-pause-filled';
	import IconPlayerPlayFilled from '@tabler/icons-svelte-runes/icons/player-play-filled';
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';

	import { formatDuration } from '#lib/media/audio-metadata.js';
	import { player } from '#lib/player/player.svelte.js';

	/**
	 * @typedef {Object} ShowcaseTrack
	 * @property {string} id
	 * @property {string} title
	 * @property {string | null} artist
	 * @property {string | null} genre
	 * @property {number | null} durationMs
	 * @property {boolean} hasCover
	 * @property {string | null} username
	 * @property {string} uploaderName
	 * @property {number} likeCount
	 */

	/**
	 * @type {{
	 *   tracks: ShowcaseTrack[],
	 *   dwellMs?: number,
	 *   resumeAfterMs?: number
	 * }}
	 */
	let { tracks, dwellMs = 3400, resumeAfterMs = 6000 } = $props();

	/** How many tiles fan out on each side before a cover fades out entirely. */
	const WING = 4;
	const TILT = 44;

	let index = $state(0);
	let paused = $state(false);
	let dragging = $state(false);
	/** Live pointer travel, applied to every tile so the fan follows the finger. */
	let dragDx = $state(0);
	/** Width of one fan step, measured from the CSS so drags snap at the right distance. */
	let stepPx = $state(0);

	let dragStartX = 0;
	let dragStartIndex = 0;
	let dragMoved = false;

	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let resumeTimer;

	const count = $derived(tracks.length);
	const active = $derived(tracks[index] ?? tracks[0]);
	const flat = $derived(prefersReducedMotion.current);
	const isActivePlaying = $derived(
		Boolean(active && player.isCurrent(active.id) && player.playing)
	);

	/** Signed distance from the centered tile, wrapping at the ends so the fan loops. */
	function offsetOf(position) {
		let distance = (position - index + count) % count;
		if (distance > count / 2) distance -= count;
		return distance;
	}

	/** @param {number} offset */
	function transformOf(offset) {
		const drag = dragging ? ` + ${dragDx}px` : '';
		// Neighbours are pushed out by an extra half step so the centred cover
		// stands clear of the fan instead of being crowded by it.
		const gap = Math.sign(offset);
		const slide = `translateX(calc(${offset} * var(--step) + ${gap} * var(--gap)${drag}))`;
		if (flat) return `translate(-50%, -50%) ${slide}`;

		const depth = Math.min(Math.abs(offset), WING);
		const lift = offset === 0 ? '6rem' : `${-depth * 3}rem`;
		const turn = offset === 0 ? 0 : -gap * TILT;
		return `translate(-50%, -50%) ${slide} translateZ(${lift}) rotateY(${turn}deg) scale(${1 - depth * 0.06})`;
	}

	/** @param {number} position */
	function goTo(position) {
		index = ((position % count) + count) % count;
	}

	/** @param {number} delta */
	function step(delta) {
		goTo(index + delta);
	}

	/** Stop the carousel until the viewer leaves it alone again. */
	function hold() {
		paused = true;
		clearTimeout(resumeTimer);
		resumeTimer = undefined;
	}

	function scheduleResume() {
		clearTimeout(resumeTimer);
		resumeTimer = setTimeout(() => (paused = false), resumeAfterMs);
	}

	/** A discrete interaction: pause now, hand control back after a quiet moment. */
	function touched() {
		hold();
		scheduleResume();
	}

	/** @param {ShowcaseTrack} track */
	function play(track) {
		player.toggle({
			id: track.id,
			title: track.title,
			artist: track.artist,
			username: track.username,
			uploaderName: track.uploaderName,
			durationMs: track.durationMs,
			hasCover: track.hasCover,
			waveform: null,
			likedByViewer: false
		});
	}

	/**
	 * @param {ShowcaseTrack} track
	 * @param {number} offset
	 * @param {number} position
	 */
	function selectTile(track, offset, position) {
		if (dragMoved) {
			dragMoved = false;
			return;
		}
		touched();
		if (offset === 0) {
			play(track);
		} else {
			goTo(position);
		}
	}

	/** @param {PointerEvent & { currentTarget: HTMLElement }} event */
	function startDrag(event) {
		if (event.button !== 0 || count < 2) return;
		dragging = true;
		dragMoved = false;
		dragStartX = event.clientX;
		dragStartIndex = index;
		event.currentTarget.setPointerCapture(event.pointerId);
		hold();
	}

	/** @param {PointerEvent} event */
	function moveDrag(event) {
		if (!dragging) return;
		dragDx = event.clientX - dragStartX;
		if (Math.abs(dragDx) > 4) dragMoved = true;
	}

	function endDrag() {
		if (!dragging) return;
		if (stepPx > 0) goTo(dragStartIndex - Math.round(dragDx / stepPx));
		dragging = false;
		dragDx = 0;
		scheduleResume();
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		touched();
		step(event.key === 'ArrowLeft' ? -1 : 1);
	}

	$effect(() => {
		if (paused || dragging || flat || count < 2) return;
		const timer = setInterval(() => step(1), dwellMs);
		return () => clearInterval(timer);
	});

	onMount(() => () => clearTimeout(resumeTimer));
</script>

<div class="cover-flow" role="group" aria-roledescription="carousel" aria-label="Featured tracks">
	<div
		class="stage"
		class:dragging
		class:flat
		role="presentation"
		onpointerenter={hold}
		onpointerleave={scheduleResume}
		onfocusin={hold}
		onfocusout={scheduleResume}
		onwheel={touched}
		onkeydown={handleKeydown}
		onpointerdown={startDrag}
		onpointermove={moveDrag}
		onpointerup={endDrag}
		onpointercancel={endDrag}
	>
		<!-- Measures one fan step in px; CSS owns the sizing, drags need the number. -->
		<span class="step-sizer" aria-hidden="true" bind:clientWidth={stepPx}></span>

		{#each tracks as track, position (track.id)}
			{@const offset = offsetOf(position)}
			{@const shown = Math.abs(offset) <= WING}
			<button
				type="button"
				class="tile"
				class:active={offset === 0}
				style:transform={transformOf(offset)}
				style:z-index={100 - Math.abs(offset)}
				style:opacity={shown ? 1 : 0}
				aria-hidden={!shown}
				tabindex={shown ? 0 : -1}
				aria-label={offset === 0
					? `${isActivePlaying ? 'Pause' : 'Play'} ${track.title} by ${track.artist || track.uploaderName}`
					: `Show ${track.title} by ${track.artist || track.uploaderName}`}
				onclick={() => selectTile(track, offset, position)}
			>
				{#if track.hasCover}
					<img
						class="tile-art"
						src="/api/media/{track.id}/cover"
						alt=""
						loading="lazy"
						draggable="false"
					/>
				{:else}
					<span class="tile-art placeholder"></span>
				{/if}

				{#if offset === 0}
					<span class="badge">
						{#if isActivePlaying}
							<IconPlayerPauseFilled size={16} aria-hidden="true" />
						{:else}
							<IconPlayerPlayFilled size={16} aria-hidden="true" />
						{/if}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	{#if active}
		<!-- Announce only while the viewer is steering; autoplay would be noise. -->
		<div class="caption" aria-live={paused ? 'polite' : 'off'}>
			<a class="caption-title" href="/tracks/{active.id}">{active.title}</a>
			<p class="caption-meta">
				{#if active.username}
					<a class="caption-artist" href="/users/{active.username}">
						{active.artist || active.uploaderName}
					</a>
				{:else}
					<span class="caption-artist">{active.artist || active.uploaderName}</span>
				{/if}
				{#if active.durationMs}
					<span class="dot" aria-hidden="true">/</span>
					<span>{formatDuration(active.durationMs)}</span>
				{/if}
				{#if active.likeCount > 0}
					<span class="dot" aria-hidden="true">/</span>
					<span class="likes">
						<IconHeart size={12} stroke={2} aria-hidden="true" />
						{active.likeCount}
					</span>
				{/if}
				{#if active.genre}
					<span class="dot" aria-hidden="true">/</span>
					<span># {active.genre}</span>
				{/if}
			</p>
		</div>
	{/if}

	{#if count > 1}
		<div class="controls">
			<button
				type="button"
				class="arrow"
				aria-label="Previous cover"
				onclick={() => {
					touched();
					step(-1);
				}}
			>
				<IconChevronLeft size={16} stroke={2} aria-hidden="true" />
			</button>

			<span class="counter">
				{String(index + 1).padStart(2, '0')}<span class="counter-total"
					>/{String(count).padStart(2, '0')}</span
				>
			</span>

			<button
				type="button"
				class="arrow"
				aria-label="Next cover"
				onclick={() => {
					touched();
					step(1);
				}}
			>
				<IconChevronRight size={16} stroke={2} aria-hidden="true" />
			</button>
		</div>

		{#if !flat}
			<div class="dwell" class:held={paused || dragging}>
				{#key index}
					<span class="dwell-fill" style:animation-duration="{dwellMs}ms"></span>
				{/key}
			</div>
		{/if}
	{/if}
</div>

<style>
	.cover-flow {
		--tile: clamp(8rem, 17vw, 15.5rem);
		--step: calc(var(--tile) * 0.5);
		--gap: calc(var(--tile) * 0.16);
		display: grid;
		gap: 1.1rem;
		justify-items: center;
		width: 100%;
	}

	.stage {
		position: relative;
		width: 100%;
		height: calc(var(--tile) * 1.5);
		perspective: 1300px;
		/* Vertical scrolling stays native; horizontal is ours to drag. */
		touch-action: pan-y;
		mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
	}

	.step-sizer {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--step);
		height: 0;
		pointer-events: none;
	}

	.tile {
		position: absolute;
		top: 50%;
		left: 50%;
		width: var(--tile);
		height: var(--tile);
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		transition:
			transform 520ms cubic-bezier(0.22, 0.61, 0.36, 1),
			opacity 380ms ease;
	}

	.stage.dragging .tile {
		transition: none;
	}

	.stage.dragging {
		cursor: grabbing;
	}

	.tile-art {
		display: block;
		width: 100%;
		height: 100%;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		background: var(--paper);
		box-shadow: 6px 6px 0 var(--cover-shadow);
		object-fit: cover;
	}

	.tile-art.placeholder {
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			linear-gradient(225deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			var(--paper);
		background-size: 14px 14px;
	}

	.tile.active .tile-art {
		border-color: var(--hard-border);
		box-shadow: 10px 10px 0 var(--cover-shadow);
	}

	.badge {
		position: absolute;
		right: -0.55rem;
		bottom: -0.55rem;
		display: grid;
		width: 2.4rem;
		height: 2.4rem;
		place-items: center;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
	}

	.badge :global(svg) {
		display: block;
	}

	.caption {
		display: grid;
		justify-items: center;
		gap: 0.3rem;
		max-width: min(100%, 32rem);
		text-align: center;
	}

	.caption-title {
		overflow: hidden;
		max-width: 100%;
		color: var(--ink);
		font-size: clamp(1.1rem, 2vw, 1.5rem);
		font-weight: 800;
		letter-spacing: -0.01em;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.caption-title:hover {
		text-decoration: underline;
		text-underline-offset: 0.25rem;
	}

	.caption-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		align-items: center;
		justify-content: center;
		margin: 0;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.caption-artist {
		color: var(--muted);
		text-decoration: none;
	}

	a.caption-artist:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.dot {
		opacity: 0.5;
	}

	.likes {
		display: inline-flex;
		gap: 0.22rem;
		align-items: center;
		font-variant-numeric: tabular-nums;
	}

	.likes :global(svg) {
		display: block;
	}

	.controls {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}

	.arrow {
		display: inline-flex;
		width: 2.1rem;
		height: 2.1rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 40%, transparent);
		color: var(--ink);
		background: transparent;
		cursor: pointer;
		transition:
			background 120ms ease,
			color 120ms ease,
			transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1);
	}

	.arrow:hover {
		border-color: var(--ink);
		color: var(--on-accent);
		background: var(--accent);
	}

	.arrow:active {
		transform: translate(1px, 1px);
	}

	.arrow :global(svg) {
		display: block;
	}

	.counter {
		color: var(--ink);
		font-size: 0.7rem;
		font-weight: 900;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.08em;
	}

	.counter-total {
		color: var(--muted);
	}

	.dwell {
		width: min(14rem, 60%);
		height: 2px;
		background: color-mix(in srgb, var(--ink) 15%, transparent);
	}

	.dwell-fill {
		display: block;
		width: 100%;
		height: 100%;
		background: var(--accent);
		transform-origin: left center;
		animation: dwell linear forwards;
	}

	.dwell.held .dwell-fill {
		animation-play-state: paused;
		opacity: 0.35;
	}

	@keyframes dwell {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}

	@media (max-width: 620px) {
		.stage {
			mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
		}
	}
</style>
