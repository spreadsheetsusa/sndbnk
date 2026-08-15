<script>
	import IconDots from '@tabler/icons-svelte-runes/icons/dots';
	import IconExternalLink from '@tabler/icons-svelte-runes/icons/external-link';
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconLink from '@tabler/icons-svelte-runes/icons/link';
	import IconList from '@tabler/icons-svelte-runes/icons/list';
	import IconMessageCircle from '@tabler/icons-svelte-runes/icons/message-circle';
	import IconPencil from '@tabler/icons-svelte-runes/icons/pencil';
	import IconPlaylistAdd from '@tabler/icons-svelte-runes/icons/playlist-add';
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';

	import CoverArt from '#lib/components/CoverArt.svelte';
	import AddToPlaylistMenu from '#lib/components/player/AddToPlaylistMenu.svelte';
	import PlayPauseGlyph from '#lib/components/player/PlayPauseGlyph.svelte';
	import { parseGenres } from '#lib/genres.js';
	import { player } from '#lib/player/player.svelte.js';
	import { toPlayerTrack } from '#lib/player/to-player-track.js';
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
	 * @property {string | null} [coverUrl]
	 * @property {string | null} [audioUrl]
	 * @property {boolean} published
	 * @property {boolean} [isPrivate]
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
	 *   onedit?: () => void,
	 *   ondeleted?: () => void
	 * }}
	 */
	let { track, selected = false, onselect, onedit, ondeleted } = $props();

	let menuOpen = $state(false);
	/** @type {HTMLButtonElement | null} */
	let moreBtn = $state(null);
	let playlistPickerOpen = $state(false);
	let copied = $state(false);
	let deleteBusy = $state(false);
	/** @type {(() => void) | null} */
	let releaseMenu = null;

	const isPlaying = $derived(player.isCurrent(track.id) && player.playing);
	const isLoading = $derived(player.isCurrent(track.id) && player.loading);
	const genres = $derived(parseGenres(track.genre));
	const extraGenreCount = $derived(Math.max(0, genres.length - 1));

	/** @returns {import('#lib/player/player.svelte.js').PlayerTrack} */
	function asPlayerTrack() {
		return toPlayerTrack(track);
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

	function closeMenuAndRestoreFocus() {
		if (!menuOpen) return;
		closeMenu();
		moreBtn?.focus();
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
		if (event.key === 'Escape' && menuOpen) closeMenuAndRestoreFocus();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="row" class:selected class:playing={isPlaying}>
	<button
		type="button"
		class="play-btn"
		aria-label={isLoading
			? `Loading ${track.title}`
			: isPlaying
				? `Pause ${track.title}`
				: `Play ${track.title}`}
		aria-busy={isLoading}
		onclick={togglePlay}
	>
		<PlayPauseGlyph playing={isPlaying} loading={isLoading} size={13} />
	</button>

	<CoverArt
		trackId={track.id}
		hasCover={track.hasCover}
		coverUrl={track.coverUrl}
		class="cover"
		width="28"
		height="28"
	/>

	<button
		type="button"
		class="name"
		aria-pressed={selected}
		aria-label="Load {track.title} into the deck"
		onclick={() => onselect?.()}
	>
		<span class="title-line">
			<span class="title">{track.title}</span>
			{#if track.published && track.isPrivate}
				<span class="private-badge" title="Only reachable by link">Private</span>
			{/if}
		</span>
		<span class="artist">{track.artist || track.uploaderName}</span>
	</button>

	<span class="cell genre" title={genres.length ? genres.join(', ') : undefined}>
		{#if genres.length}
			<span class="genre-chips">
				<span class="genre-chip">{genres[0]}</span>
				{#if extraGenreCount}
					<span class="genre-more">+{extraGenreCount}</span>
				{/if}
			</span>
		{:else}
			—
		{/if}
	</span>

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

	<div class="menu-wrap" {@attach menuClickOutside}>
		<button
			type="button"
			class="more-btn"
			bind:this={moreBtn}
			aria-label="More actions for {track.title}"
			aria-expanded={menuOpen}
			aria-haspopup="menu"
			aria-controls="library-menu-{track.id}"
			onclick={toggleMenu}
		>
			<span class="more-icon" aria-hidden="true">
				<IconDots size={15} stroke={1.75} />
			</span>
			<span class="more-cover" aria-hidden="true">
				<CoverArt trackId={track.id} hasCover={track.hasCover} coverUrl={track.coverUrl} />
			</span>
		</button>

		{#if menuOpen}
			<div class="menu" id="library-menu-{track.id}" role="menu">
				<a class="menu-item" role="menuitem" href="/tracks/{track.id}">
					<span class="menu-icon" aria-hidden="true">
						<IconExternalLink size={14} stroke={1.75} />
					</span>
					Open page
				</a>
				<button
					type="button"
					class="menu-item"
					role="menuitem"
					onclick={() => {
						closeMenu();
						onedit?.();
					}}
				>
					<span class="menu-icon" aria-hidden="true">
						<IconPencil size={14} stroke={1.75} />
					</span>
					Edit
				</button>
				<button type="button" role="menuitem" onclick={copyLink}>
					<span class="menu-icon" aria-hidden="true">
						<IconLink size={14} stroke={1.75} />
					</span>
					{copied ? 'Copied!' : 'Copy link'}
				</button>
				<div class="menu-sep" role="separator"></div>
				<button type="button" role="menuitem" onclick={addToNextUp}>
					<span class="menu-icon" aria-hidden="true">
						<IconList size={14} stroke={1.75} />
					</span>
					Add to Next Up
				</button>
				<div class="menu-sep" role="separator"></div>
				<button
					type="button"
					role="menuitem"
					onclick={() => (playlistPickerOpen = !playlistPickerOpen)}
				>
					<span class="menu-icon" aria-hidden="true">
						<IconPlaylistAdd size={14} stroke={1.75} />
					</span>
					Add to playlist…
				</button>
				{#if playlistPickerOpen}
					<div class="playlist-picker">
						<AddToPlaylistMenu
							trackId={track.id}
							onclose={() => {
								playlistPickerOpen = false;
								menuOpen = false;
							}}
						/>
					</div>
				{/if}
				<div class="menu-sep" role="separator"></div>
				<button
					type="button"
					role="menuitem"
					class="danger"
					disabled={deleteBusy}
					onclick={deleteTrack}
				>
					<span class="menu-icon" aria-hidden="true">
						<IconTrash size={14} stroke={1.75} />
					</span>
					Delete
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
		/* Desaturated accent at 10% opacity — no edge accent bar. */
		background: color-mix(
			in srgb,
			color-mix(in srgb, var(--accent) 58%, var(--ink)) 10%,
			transparent
		);
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

	.row :global(img.cover),
	.row :global(span.cover.placeholder) {
		display: block;
		width: 1.75rem;
		height: 1.75rem;
		border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
		border-radius: 0.125rem;
		object-fit: cover;
	}

	.row :global(span.cover.placeholder) {
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

	.title-line {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
	}

	.title {
		overflow: hidden;
		min-width: 0;
		max-width: 100%;
		color: var(--ink);
		font-size: 0.85rem;
		font-weight: 800;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex-shrink: 1;
	}

	.private-badge {
		flex-shrink: 0;
		padding: 0.15rem 0.35rem;
		border: 1px solid color-mix(in srgb, var(--ink) 30%, transparent);
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 25%, var(--paper));
		color: var(--ink);
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
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

	.genre-chips {
		display: inline-flex;
		gap: 0.25rem;
		align-items: center;
		min-width: 0;
		max-width: 100%;
	}

	.genre-chip {
		overflow: hidden;
		min-width: 0;
		padding: 0.1rem 0.4rem;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		color: var(--ink);
		font-size: 0.68rem;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.genre-more {
		flex-shrink: 0;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
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

	.more-cover :global(.cover-placeholder) {
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
		min-width: 12.5rem;
		padding: 0.3rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.menu-sep {
		height: 1px;
		margin: 0.2rem 0.35rem;
		background: color-mix(in srgb, var(--ink) 16%, transparent);
	}

	.playlist-picker {
		padding: 0.15rem 0 0.25rem;
	}

	.playlist-picker :global(.picker) {
		position: static;
		box-shadow: none;
		border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
	}

	.menu button,
	.menu .menu-item {
		display: flex;
		gap: 0.45rem;
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

	.menu-icon {
		display: inline-flex;
		flex-shrink: 0;
		width: 0.95rem;
		align-items: center;
		justify-content: center;
	}

	.menu-icon :global(svg) {
		display: block;
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
			grid-template-columns: auto auto minmax(0, 1fr);
			grid-template-areas:
				'play menu name'
				'. . meta';
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

		.row :global(img.cover),
		.row :global(span.cover.placeholder),
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

		.more-cover :global(img) {
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
	}
</style>
