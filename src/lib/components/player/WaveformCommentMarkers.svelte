<script>
	import { fade } from 'svelte/transition';

	import Avatar from '#lib/components/Avatar.svelte';
	import { formatDuration } from '#lib/media/audio-metadata.js';

	/**
	 * @typedef {Object} MarkerComment
	 * @property {string} id
	 * @property {string} body
	 * @property {number} atMs
	 * @property {number} createdAt
	 * @property {string} userId
	 * @property {string} userName
	 * @property {string | null} userImage
	 * @property {number} leftPct
	 */

	const DRAG_THRESHOLD_PX = 5;

	/**
	 * Timed-comment overlay for waveforms. Author markers render as a vertical
	 * accent stem with a draggable avatar ping; others stay mid-wave avatars.
	 *
	 * @type {{
	 *   trackId: string,
	 *   markers: MarkerComment[],
	 *   viewerId?: string | null,
	 *   durationMs: number,
	 *   playheadMarkerId?: string | null,
	 *   avatarSize?: string,
	 *   draggable?: boolean,
	 *   onseek?: (seconds: number) => void,
	 *   onscrub?: (seconds: number | null) => void,
	 *   onrepositioned?: (comment: MarkerComment) => void
	 * }}
	 */
	let {
		trackId,
		markers,
		viewerId = null,
		durationMs,
		playheadMarkerId = null,
		avatarSize = '1.15rem',
		draggable = true,
		onseek,
		onscrub,
		onrepositioned
	} = $props();

	/** @type {HTMLElement | null} */
	let root = $state.raw(null);
	/** @type {string | null} */
	let hoveredMarkerId = $state(null);
	/** @type {string | null} */
	let draggingId = $state(null);
	/** Live position while dragging (ms). @type {number | null} */
	let dragAtMs = $state(null);
	/** @type {string | null} */
	let statusNote = $state(null);
	let saveBusy = $state(false);

	/** @type {{ pointerId: number, startX: number, startAtMs: number, moved: boolean } | null} */
	let dragSession = null;

	const hasOwn = $derived(
		Boolean(viewerId) && markers.some((marker) => marker.userId === viewerId)
	);

	const displayMarkers = $derived.by(() => {
		if (draggingId == null || dragAtMs == null || durationMs <= 0) return markers;
		return markers.map((marker) => {
			if (marker.id !== draggingId) return marker;
			const atMs = dragAtMs;
			return {
				...marker,
				atMs,
				leftPct: Math.min(Math.max((atMs / durationMs) * 100, 0), 100)
			};
		});
	});

	const activeMarker = $derived.by(() => {
		const fromHover = displayMarkers.find((marker) => marker.id === hoveredMarkerId);
		if (fromHover) return fromHover;
		if (draggingId) {
			return displayMarkers.find((marker) => marker.id === draggingId) ?? null;
		}
		return displayMarkers.find((marker) => marker.id === playheadMarkerId) ?? null;
	});

	/**
	 * @param {PointerEvent} event
	 * @returns {number}
	 */
	function atMsFromPointer(event) {
		const el = root;
		if (!el || durationMs <= 0) return 0;
		const rect = el.getBoundingClientRect();
		if (rect.width <= 0) return 0;
		const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
		return Math.round(ratio * durationMs);
	}

	/** @param {MarkerComment} marker */
	function isOwn(marker) {
		return Boolean(viewerId && marker.userId === viewerId);
	}

	/** @param {MarkerComment} marker */
	function canDrag(marker) {
		return draggable && isOwn(marker) && !saveBusy;
	}

	/** @param {PointerEvent} event @param {MarkerComment} marker */
	function onMarkerPointerDown(event, marker) {
		if (!canDrag(marker) || event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		dragSession = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startAtMs: marker.atMs,
			moved: false
		};
		draggingId = marker.id;
		dragAtMs = marker.atMs;
		hoveredMarkerId = marker.id;
		try {
			/** @type {HTMLElement} */ (event.currentTarget).setPointerCapture(event.pointerId);
		} catch {
			// Capture can fail if the pointer already left; window listeners still finish.
		}
	}

	/** @param {PointerEvent} event */
	function onMarkerPointerMove(event) {
		if (!dragSession || event.pointerId !== dragSession.pointerId) return;
		event.stopPropagation();
		const dx = Math.abs(event.clientX - dragSession.startX);
		if (!dragSession.moved && dx < DRAG_THRESHOLD_PX) return;
		dragSession.moved = true;
		const next = atMsFromPointer(event);
		dragAtMs = next;
		onscrub?.(next / 1000);
	}

	/** @param {PointerEvent} event @param {MarkerComment} marker */
	async function onMarkerPointerUp(event, marker) {
		if (!dragSession || event.pointerId !== dragSession.pointerId) return;
		event.stopPropagation();
		const session = dragSession;
		dragSession = null;

		const target = /** @type {HTMLElement} */ (event.currentTarget);
		try {
			target.releasePointerCapture(event.pointerId);
		} catch {
			// Already released.
		}

		if (!session.moved) {
			draggingId = null;
			dragAtMs = null;
			onscrub?.(null);
			onseek?.(marker.atMs / 1000);
			return;
		}

		const nextAtMs = dragAtMs ?? atMsFromPointer(event);
		onscrub?.(null);

		if (nextAtMs === session.startAtMs) {
			draggingId = null;
			dragAtMs = null;
			return;
		}

		saveBusy = true;
		statusNote = null;
		try {
			const res = await fetch(`/api/tracks/${trackId}/comments/${marker.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ atMs: nextAtMs })
			});
			if (!res.ok) {
				dragAtMs = session.startAtMs;
				statusNote = 'Could not move comment';
				setTimeout(() => (statusNote = null), 2200);
				return;
			}
			const data = await res.json();
			const comment = data.comment;
			const leftPct =
				durationMs > 0 ? Math.min(Math.max((comment.atMs / durationMs) * 100, 0), 100) : 0;
			/** @type {MarkerComment} */
			const next = {
				id: comment.id,
				body: comment.body,
				atMs: comment.atMs,
				createdAt: comment.createdAt,
				userId: comment.userId,
				userName: comment.userName,
				userImage: comment.userImage,
				leftPct
			};
			onrepositioned?.(next);
			onseek?.(comment.atMs / 1000);
			statusNote = `Moved to ${formatDuration(comment.atMs)}`;
			setTimeout(() => (statusNote = null), 2200);
		} catch {
			dragAtMs = session.startAtMs;
			statusNote = 'Could not move comment';
			setTimeout(() => (statusNote = null), 2200);
		} finally {
			draggingId = null;
			dragAtMs = null;
			saveBusy = false;
		}
	}

	/** @param {PointerEvent} event */
	function onMarkerPointerCancel(event) {
		if (!dragSession || event.pointerId !== dragSession.pointerId) return;
		const start = dragSession.startAtMs;
		dragSession = null;
		draggingId = null;
		dragAtMs = start;
		onscrub?.(null);
		queueMicrotask(() => {
			dragAtMs = null;
		});
	}

	/** @param {MarkerComment} marker */
	function onOtherClick(marker) {
		onseek?.(marker.atMs / 1000);
	}
</script>

<div class="markers" class:has-own={hasOwn} class:dragging={draggingId != null} bind:this={root}>
	{#each displayMarkers as marker (marker.id)}
		{#if isOwn(marker)}
			<button
				type="button"
				class="pin"
				class:active={activeMarker?.id === marker.id}
				class:dragging={draggingId === marker.id}
				class:draggable={canDrag(marker)}
				style:left="{marker.leftPct}%"
				aria-label="{marker.userName} commented at {formatDuration(
					marker.atMs
				)}: {marker.body}. {canDrag(marker) ? 'Drag to reposition.' : ''}"
				aria-grabbed={draggingId === marker.id}
				disabled={saveBusy && draggingId === marker.id}
				onpointerdown={(event) => onMarkerPointerDown(event, marker)}
				onpointermove={onMarkerPointerMove}
				onpointerup={(event) => onMarkerPointerUp(event, marker)}
				onpointercancel={onMarkerPointerCancel}
				onmouseenter={() => (hoveredMarkerId = marker.id)}
				onmouseleave={() => {
					if (draggingId !== marker.id) hoveredMarkerId = null;
				}}
				onfocus={() => (hoveredMarkerId = marker.id)}
				onblur={() => {
					if (draggingId !== marker.id) hoveredMarkerId = null;
				}}
			>
				<span class="pin-stem" aria-hidden="true"></span>
				<span class="pin-ping">
					<Avatar src={marker.userImage} name={marker.userName} size={avatarSize} />
				</span>
				{#if draggingId === marker.id}
					<span class="pin-lcd lcd-face" aria-hidden="true">{formatDuration(marker.atMs)}</span>
				{/if}
			</button>
		{:else}
			<button
				type="button"
				class="marker"
				class:active={activeMarker?.id === marker.id}
				style:left="{marker.leftPct}%"
				aria-label="{marker.userName} commented at {formatDuration(marker.atMs)}: {marker.body}"
				onclick={() => onOtherClick(marker)}
				onmouseenter={() => (hoveredMarkerId = marker.id)}
				onmouseleave={() => (hoveredMarkerId = null)}
				onfocus={() => (hoveredMarkerId = marker.id)}
				onblur={() => (hoveredMarkerId = null)}
			>
				<Avatar src={marker.userImage} name={marker.userName} size={avatarSize} />
			</button>
		{/if}
	{/each}

	{#if activeMarker}
		<div
			class="marker-tip"
			class:own={isOwn(activeMarker)}
			style:left="min(max({activeMarker.leftPct}%, 4rem), calc(100% - 4rem))"
			transition:fade={{ duration: 120 }}
		>
			<span class="tip-time lcd-face">{formatDuration(activeMarker.atMs)}</span>
			<span class="tip-name">{activeMarker.userName}</span>
			<span class="tip-body">{activeMarker.body}</span>
		</div>
	{/if}

	{#if statusNote}
		<span class="marker-status" role="status">{statusNote}</span>
	{/if}
</div>

<style>
	.markers {
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
	}

	.markers.has-own {
		top: -1.15rem;
		height: calc(100% + 1.15rem);
	}

	.markers.dragging {
		cursor: ew-resize;
	}

	.marker,
	.pin {
		pointer-events: auto;
		position: absolute;
		padding: 0;
		border: 0;
		background: transparent;
	}

	.marker {
		top: 50%;
		display: inline-flex;
		transform: translate(-50%, -50%);
		cursor: pointer;
		--avatar-border: 1px solid var(--paper);
		--avatar-font-size: 0.55rem;
	}

	.markers.has-own .marker {
		top: calc(50% + 0.575rem);
	}

	.marker:hover,
	.marker.active {
		transform: translate(-50%, -50%) scale(1.15);
		--avatar-border: 1px solid var(--ink);
	}

	.pin {
		top: 0;
		bottom: 0;
		width: 1.6rem;
		transform: translateX(-50%);
		cursor: pointer;
	}

	.pin.draggable {
		cursor: grab;
	}

	.pin.dragging {
		cursor: ew-resize;
		z-index: 5;
	}

	.pin-stem {
		position: absolute;
		top: 0.55rem;
		bottom: 0;
		left: 50%;
		width: 2px;
		transform: translateX(-50%);
		background: linear-gradient(
			to bottom,
			var(--accent),
			color-mix(in srgb, var(--accent) 55%, var(--ink))
		);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--ink) 28%, transparent),
			2px 0 0 color-mix(in srgb, var(--accent) 22%, transparent);
		opacity: 0.92;
	}

	.pin:hover .pin-stem,
	.pin.active .pin-stem,
	.pin.dragging .pin-stem {
		opacity: 1;
		width: 3px;
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--ink) 40%, transparent),
			3px 0 0 color-mix(in srgb, var(--accent) 30%, transparent);
	}

	.pin-ping {
		position: absolute;
		top: 0;
		left: 50%;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		transform: translateX(-50%);
		border: 1px solid var(--accent);
		border-radius: 0.125rem;
		background: var(--paper);
		box-shadow: 2px 2px 0 var(--hard-shadow);
		--avatar-border: 0;
		--avatar-font-size: 0.55rem;
	}

	.pin-ping :global(.avatar) {
		width: 100%;
		height: 100%;
		border-radius: 0.125rem;
	}

	.pin:hover .pin-ping,
	.pin.active .pin-ping {
		border-color: var(--ink);
		transform: translateX(-50%) scale(1.08);
	}

	.pin.dragging .pin-ping {
		border-color: var(--ink);
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
		transform: translateX(-50%) scale(1.12);
		box-shadow: 3px 3px 0 var(--hard-shadow);
	}

	.pin.draggable:not(.dragging) .pin-ping {
		animation: pin-pulse 2.4s ease-in-out infinite;
	}

	.pin-lcd {
		position: absolute;
		top: 1.45rem;
		left: 50%;
		z-index: 2;
		padding: 0.05rem 0.28rem;
		border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--ink));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 22%, var(--inverse));
		color: var(--on-inverse);
		font-size: 0.72rem;
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
		transform: translateX(-50%);
		pointer-events: none;
		white-space: nowrap;
	}

	.marker-tip {
		pointer-events: none;
		position: absolute;
		top: calc(50% + 1.1rem);
		z-index: 4;
		display: flex;
		max-width: min(18rem, 90%);
		gap: 0.35rem;
		align-items: baseline;
		padding: 0.22rem 0.5rem;
		border-radius: 999px;
		background: var(--inverse);
		color: var(--on-inverse);
		font-size: 0.68rem;
		line-height: 1.35;
		transform: translateX(-50%);
	}

	.markers.has-own .marker-tip {
		top: calc(50% + 1.675rem);
	}

	.marker-tip.own {
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		border-radius: 0.125rem;
		box-shadow: 2px 2px 0 color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.tip-time {
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
		color: color-mix(in srgb, var(--accent) 70%, var(--on-inverse));
		white-space: nowrap;
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

	.marker-status {
		pointer-events: none;
		position: absolute;
		right: 0;
		bottom: calc(100% + 0.2rem);
		z-index: 5;
		padding: 0.12rem 0.35rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		border-radius: 0.125rem;
		background: var(--paper);
		color: var(--ink);
		font-size: 0.68rem;
		font-weight: 700;
		box-shadow: 2px 2px 0 var(--hard-shadow);
	}

	@keyframes pin-pulse {
		0%,
		100% {
			transform: translateX(-50%) scale(1);
		}
		50% {
			transform: translateX(-50%) scale(1.06);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pin.draggable:not(.dragging) .pin-ping {
			animation: none;
		}
	}

	@media (pointer: coarse) {
		.pin {
			width: 2rem;
		}

		.pin-ping {
			width: 1.55rem;
			height: 1.55rem;
		}

		.marker :global(.avatar),
		.pin-ping :global(.avatar) {
			/* Coarse hit target; Avatar size prop still sets --avatar-size. */
			min-width: 1.35rem;
			min-height: 1.35rem;
		}
	}
</style>
