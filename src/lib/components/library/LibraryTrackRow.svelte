<script>
	import IconDots from '@tabler/icons-svelte-runes/icons/dots';
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconMessageCircle from '@tabler/icons-svelte-runes/icons/message-circle';
	import IconPlayerPauseFilled from '@tabler/icons-svelte-runes/icons/player-pause-filled';
	import IconPlayerPlayFilled from '@tabler/icons-svelte-runes/icons/player-play-filled';

	import { player } from '#lib/player/player.svelte.js';
	import { formatDuration } from '#lib/media/audio-metadata.js';
	import { relativeTime } from '#lib/relative-time.js';
	import { claimRowMenu } from './library-row-menu.js';

	/**
	 * @typedef {Object} RowTrack
	 * @property {string} id
	 * @property {string} title
	 * @property {string | null} artist
	 * @property {string | null} genre
	 * @property {number | null} durationMs
	 * @property {boolean} hasCover
	 * @property {boolean} published
	 * @property {number} createdAt
	 * @property {string | null} username
	 * @property {string} uploaderName
	 * @property {number[] | null} waveform
	 * @property {number} likeCount
	 * @property {number} commentCount
	 * @property {boolean} likedByViewer
	 */

	/**
	 * @type {{
	 *   track: RowTrack,
	 *   selected?: boolean,
	 *   onselect?: () => void,
	 *   ondeleted?: () => void
	 * }}
	 */
	let { track, selected = false, onselect, ondeleted } = $props();

	let menuOpen = $state(false);
	let copied = $state(false);
	let deleteBusy = $state(false);
	let publishBusy = $state(false);
	/** @type {boolean | null} */
	let publishOverride = $state(null);
	/** @type {(() => void) | null} */
	let releaseMenu = null;

	const isPlaying = $derived(player.isCurrent(track.id) && player.playing);
	const published = $derived(publishOverride ?? track.published);

	/** @returns {import('#lib/player/player.svelte.js').PlayerTrack} */
	function asPlayerTrack() {
		return {
			id: track.id,
			title: track.title,
			artist: track.artist,
			username: track.username,
			uploaderName: track.uploaderName,
			durationMs: track.durationMs,
			hasCover: track.hasCover,
			waveform: track.waveform,
			likedByViewer: track.likedByViewer
		};
	}

	function togglePlay() {
		onselect?.();
		player.toggle(asPlayerTrack());
	}

	function closeMenu() {
		if (!menuOpen) return;
		menuOpen = false;
		releaseMenu?.();
		releaseMenu = null;
	}

	function toggleMenu() {
		if (menuOpen) {
			closeMenu();
			return;
		}
		releaseMenu = claimRowMenu(closeMenu);
		menuOpen = true;
	}

	async function copyLink() {
		closeMenu();
		try {
			await navigator.clipboard.writeText(`${location.origin}/tracks/${track.id}`);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard unavailable (permissions/insecure context); ignore.
		}
	}

	function addToNextUp() {
		player.addToQueue(asPlayerTrack());
		closeMenu();
	}

	async function togglePublished() {
		if (publishBusy) return;
		publishBusy = true;
		try {
			const res = await fetch(`/api/tracks/${track.id}/publish`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ published: !published })
			});
			if (res.ok) {
				const data = await res.json();
				publishOverride = data.published;
			}
		} finally {
			publishBusy = false;
		}
	}

	async function deleteTrack() {
		if (deleteBusy) return;
		if (!confirm(`Delete “${track.title}”? This cannot be undone.`)) {
			closeMenu();
			return;
		}
		deleteBusy = true;
		try {
			const res = await fetch(`/api/tracks/${track.id}`, { method: 'DELETE' });
			if (res.ok) {
				player.evict(track.id);
				ondeleted?.();
			}
		} finally {
			deleteBusy = false;
			closeMenu();
		}
	}

	/** @type {import('svelte/attachments').Attachment} */
	function menuClickOutside(node) {
		/** @param {PointerEvent} event */
		function onPointerDown(event) {
			if (!menuOpen) return;
			const target = /** @type {Node | null} */ (event.target);
			if (target && !node.contains(target)) closeMenu();
		}
		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key === 'Escape' && menuOpen) closeMenu();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="row" class:selected class:playing={isPlaying}>
	<button
		type="button"
		class="play-btn"
		aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
		onclick={togglePlay}
	>
		{#if isPlaying}
			<IconPlayerPauseFilled size={13} aria-hidden="true" />
		{:else}
			<IconPlayerPlayFilled size={13} aria-hidden="true" />
		{/if}
	</button>

	{#if track.hasCover}
		<img
			class="cover"
			src="/api/media/{track.id}/cover"
			alt=""
			loading="lazy"
			width="28"
			height="28"
		/>
	{:else}
		<span class="cover placeholder" aria-hidden="true"></span>
	{/if}

	<button
		type="button"
		class="name"
		aria-pressed={selected}
		aria-label="Load {track.title} into the deck"
		onclick={() => onselect?.()}
	>
		<span class="title">{track.title}</span>
		<span class="artist">{track.artist || track.uploaderName}</span>
	</button>

	<span class="cell genre">{track.genre ?? '—'}</span>

	<span class="meta">
		<span class="cell duration">{formatDuration(track.durationMs)}</span>
		<span class="cell stats">
			<span class="stat">
				<IconHeart size={13} stroke={1.75} aria-hidden="true" />
				{track.likeCount}
			</span>
			<span class="stat">
				<IconMessageCircle size={13} stroke={1.75} aria-hidden="true" />
				{track.commentCount}
			</span>
		</span>
	</span>

	<span class="cell added" title={new Date(track.createdAt).toLocaleString()}>
		{relativeTime(track.createdAt)}
	</span>

	<button
		type="button"
		class="publish-switch"
		role="switch"
		aria-checked={published}
		aria-label={published ? `Unpublish ${track.title}` : `Publish ${track.title}`}
		title={published ? 'Visible on your public profile' : 'Hidden from your public profile'}
		disabled={publishBusy}
		onclick={togglePublished}
	>
		<span class="knob"></span>
	</button>

	<div class="menu-wrap" {@attach menuClickOutside}>
		<button
			type="button"
			class="more-btn"
			aria-label="More actions for {track.title}"
			aria-expanded={menuOpen}
			aria-haspopup="menu"
			onclick={toggleMenu}
		>
			<span class="more-icon" aria-hidden="true">
				<IconDots size={15} stroke={1.75} />
			</span>
			<span class="more-cover" aria-hidden="true">
				{#if track.hasCover}
					<img src="/api/media/{track.id}/cover" alt="" loading="lazy" />
				{:else}
					<span class="cover-thumb-placeholder"></span>
				{/if}
			</span>
		</button>

		{#if menuOpen}
			<div class="menu" role="menu">
				<a class="menu-item" role="menuitem" href="/tracks/{track.id}">Open page</a>
				<a class="menu-item" role="menuitem" href="/library/{track.id}">Edit</a>
				<button type="button" role="menuitem" onclick={copyLink}>
					{copied ? 'Copied!' : 'Copy link'}
				</button>
				<button type="button" role="menuitem" onclick={addToNextUp}>Add to Next Up</button>
				<button
					type="button"
					role="menuitem"
					class="danger"
					disabled={deleteBusy}
					onclick={deleteTrack}
				>
					Delete track
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: var(--library-grid);
		gap: 0.6rem;
		align-items: center;
		padding: 0.3rem 0.5rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
	}

	.row:hover {
		background: color-mix(in srgb, var(--ink) 5%, transparent);
	}

	.row.selected {
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		box-shadow: inset 2px 0 0 var(--accent);
	}

	.play-btn {
		display: inline-flex;
		width: 1.7rem;
		height: 1.7rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 30%, transparent);
		color: var(--ink);
		background: transparent;
		cursor: pointer;
	}

	.play-btn :global(svg) {
		display: block;
	}

	.play-btn:hover,
	.row.playing .play-btn {
		border-color: var(--ink);
		color: var(--on-accent);
		background: var(--accent);
	}

	.cover {
		display: block;
		width: 1.75rem;
		height: 1.75rem;
		border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
		border-radius: 0.125rem;
		object-fit: cover;
	}

	.cover.placeholder {
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			var(--paper);
		background-size: 8px 8px;
	}

	.name {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		min-width: 0;
		padding: 0.2rem 0;
		border: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}

	.title {
		overflow: hidden;
		max-width: 100%;
		color: var(--ink);
		font-size: 0.85rem;
		font-weight: 800;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex-shrink: 1;
	}

	.artist {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.75rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name:hover .title {
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.cell {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.75rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Children participate in the row grid so desktop columns stay aligned. */
	.meta {
		display: contents;
	}

	.duration {
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.stats {
		display: flex;
		gap: 0.6rem;
	}

	.stat {
		display: inline-flex;
		gap: 0.2rem;
		align-items: center;
		font-variant-numeric: tabular-nums;
	}

	.stat :global(svg) {
		display: block;
	}

	.publish-switch {
		display: inline-flex;
		width: 2.2rem;
		height: 1.1rem;
		align-items: center;
		padding: 1px;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		background: transparent;
		cursor: pointer;
	}

	.publish-switch[aria-checked='true'] {
		border-color: var(--ink);
		background: var(--accent);
	}

	.publish-switch:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.knob {
		width: 0.85rem;
		height: 0.85rem;
		background: color-mix(in srgb, var(--ink) 45%, transparent);
		transition: transform 120ms ease;
	}

	.publish-switch[aria-checked='true'] .knob {
		background: var(--on-accent);
		transform: translateX(1.05rem);
	}

	.menu-wrap {
		position: relative;
	}

	.more-btn {
		display: inline-flex;
		width: 1.7rem;
		height: 1.7rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid transparent;
		color: var(--muted);
		background: transparent;
		cursor: pointer;
	}

	.more-btn:hover,
	.more-btn[aria-expanded='true'] {
		border-color: var(--ink);
		color: var(--on-accent);
		background: var(--accent);
	}

	.more-btn :global(svg) {
		display: block;
	}

	.more-cover {
		display: none;
	}

	.cover-thumb-placeholder {
		display: block;
		width: 100%;
		height: 100%;
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			var(--paper);
		background-size: 8px 8px;
	}

	.menu {
		position: absolute;
		z-index: 30;
		top: calc(100% + 0.3rem);
		right: 0;
		display: grid;
		min-width: 11rem;
		padding: 0.3rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.menu button,
	.menu .menu-item {
		display: flex;
		width: 100%;
		align-items: center;
		padding: 0.5rem 0.6rem;
		border: 0;
		background: transparent;
		color: var(--ink);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-align: left;
		text-decoration: none;
		text-transform: uppercase;
		cursor: pointer;
	}

	.menu button:not(:disabled):hover,
	.menu .menu-item:hover {
		color: var(--on-accent);
		background: var(--accent);
	}

	.menu button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.menu button.danger:not(:disabled):hover {
		color: #fff;
		background: #c2321e;
	}

	@media (max-width: 960px) {
		.stats,
		.added {
			display: none;
		}
	}

	@media (max-width: 640px) {
		.row {
			grid-template-columns: auto auto minmax(0, 1fr) auto;
			grid-template-areas:
				'play menu name publish'
				'. . meta .';
			column-gap: 0.45rem;
			row-gap: 0.15rem;
			padding: 0.4rem 0.5rem;
		}

		.play-btn {
			grid-area: play;
			align-self: start;
		}

		.menu-wrap {
			grid-area: menu;
			align-self: start;
		}

		.name {
			grid-area: name;
			padding: 0;
		}

		.meta {
			display: flex;
			grid-area: meta;
			gap: 0.55rem;
			align-items: center;
			min-width: 0;
			color: var(--muted);
			font-size: 0.7rem;
		}

		.duration {
			text-align: left;
		}

		.stats {
			display: flex;
			gap: 0.45rem;
		}

		.publish-switch {
			grid-area: publish;
			align-self: start;
			justify-self: end;
			margin-top: 0.2rem;
		}

		.cover,
		.genre,
		.added {
			display: none;
		}

		.more-icon {
			display: none;
		}

		.more-cover {
			display: block;
			width: 100%;
			height: 100%;
		}

		.more-cover img {
			display: block;
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		.more-btn {
			position: relative;
			display: block;
			width: 1.75rem;
			height: 1.75rem;
			padding: 0;
			overflow: hidden;
			border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
			border-radius: 0.125rem;
			color: inherit;
			background: transparent;
		}

		.more-btn:hover,
		.more-btn[aria-expanded='true'] {
			border-color: var(--ink);
			color: inherit;
			background: transparent;
			outline: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
			outline-offset: 1px;
		}

		.more-btn:hover::after,
		.more-btn[aria-expanded='true']::after {
			content: '';
			position: absolute;
			inset: 0;
			background: color-mix(in srgb, var(--accent) 18%, transparent);
			pointer-events: none;
		}

		.menu {
			left: 0;
			right: auto;
		}
	}

	@media (pointer: coarse) {
		.play-btn,
		.more-btn {
			width: var(--tap-min);
			height: var(--tap-min);
		}

		.publish-switch {
			min-height: var(--tap-min);
		}
	}
</style>
