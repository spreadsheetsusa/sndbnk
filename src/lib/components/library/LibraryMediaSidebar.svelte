<script>
	import IconDots from '@tabler/icons-svelte-runes/icons/dots';
	import IconFolder from '@tabler/icons-svelte-runes/icons/folder';
	import IconHeadphones from '@tabler/icons-svelte-runes/icons/headphones';
	import IconMicrophone from '@tabler/icons-svelte-runes/icons/microphone';
	import IconMusic from '@tabler/icons-svelte-runes/icons/music';
	import IconPlaylist from '@tabler/icons-svelte-runes/icons/playlist';
	import IconPlus from '@tabler/icons-svelte-runes/icons/plus';
	import IconRepeat from '@tabler/icons-svelte-runes/icons/repeat';
	import IconWaveSine from '@tabler/icons-svelte-runes/icons/wave-sine';
	import { tick } from 'svelte';

	import { TRACK_MEDIA_TYPE_OPTIONS } from '#lib/media/track-media-type.js';
	import { player } from '#lib/player/player.svelte.js';
	import { claimRowMenu } from './library-row-menu.js';

	/**
	 * @typedef {{
	 *   id: string,
	 *   title: string,
	 *   published: boolean,
	 *   createdAt: number,
	 *   trackCount: number
	 * }} PlaylistSummary
	 *
	 * @typedef {{
	 *   kind: 'all'
	 * } | {
	 *   kind: 'type',
	 *   mediaType: import('#lib/media/track-media-type.js').TrackMediaType
	 * } | {
	 *   kind: 'playlist',
	 *   playlistId: string
	 * }} LibrarySource
	 */

	/** @type {Record<import('#lib/media/track-media-type.js').TrackMediaType, typeof IconMusic>} */
	const MEDIA_TYPE_ICONS = {
		track: IconMusic,
		mix: IconHeadphones,
		sample: IconWaveSine,
		loop: IconRepeat,
		podcast: IconMicrophone
	};

	/**
	 * @type {{
	 *   playlists: PlaylistSummary[],
	 *   activePlaylistId: string | null,
	 *   activeMediaType?: string | null,
	 *   onselect: (source: LibrarySource) => void,
	 *   oncreated?: (playlist: PlaylistSummary) => void,
	 *   ondeleted?: (playlistId: string) => void
	 * }}
	 */
	let {
		playlists,
		activePlaylistId,
		activeMediaType = null,
		onselect,
		oncreated,
		ondeleted
	} = $props();

	const allMediaActive = $derived(activePlaylistId == null && activeMediaType == null);

	let creating = $state(false);
	let createTitle = $state('');
	let createBusy = $state(false);
	/** @type {string | null} */
	let createError = $state(null);
	/** @type {HTMLInputElement | null} */
	let createInput = $state(null);

	/** @type {string | null} */
	let menuPlaylistId = $state(null);
	/** @type {HTMLButtonElement | null} */
	let menuTrigger = $state(null);
	let copied = $state(false);
	let deleteBusy = $state(false);
	let queueBusy = $state(false);
	/** @type {(() => void) | null} */
	let releaseMenu = null;

	async function startCreate() {
		creating = true;
		createTitle = '';
		createError = null;
		await tick();
		createInput?.focus();
	}

	function cancelCreate() {
		creating = false;
		createTitle = '';
		createError = null;
	}

	async function commitCreate() {
		const title = createTitle.trim();
		if (!title || createBusy) return;
		createBusy = true;
		createError = null;
		try {
			const res = await fetch('/api/playlists', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => null);
				createError = data?.message ?? 'Could not create playlist.';
				return;
			}
			const data = await res.json();
			creating = false;
			createTitle = '';
			oncreated?.(data.playlist);
			onselect({ kind: 'playlist', playlistId: data.playlist.id });
		} finally {
			createBusy = false;
		}
	}

	/** @param {KeyboardEvent} event */
	function onCreateKeydown(event) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitCreate();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelCreate();
		}
	}

	function closeMenu() {
		if (menuPlaylistId == null) return;
		menuPlaylistId = null;
		menuTrigger = null;
		releaseMenu?.();
		releaseMenu = null;
	}

	function closeMenuAndRestoreFocus() {
		if (menuPlaylistId == null) return;
		const trigger = menuTrigger;
		closeMenu();
		trigger?.focus();
	}

	/**
	 * @param {string} id
	 * @param {HTMLButtonElement} trigger
	 */
	function toggleMenu(id, trigger) {
		if (menuPlaylistId === id) {
			closeMenu();
			return;
		}
		releaseMenu = claimRowMenu(closeMenu);
		menuTrigger = trigger;
		menuPlaylistId = id;
	}

	/** @param {PlaylistSummary} pl */
	async function copyLink(pl) {
		closeMenu();
		try {
			await navigator.clipboard.writeText(`${location.origin}/playlists/${pl.id}`);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard unavailable.
		}
	}

	/** @param {PlaylistSummary} pl */
	async function addToNextUp(pl) {
		if (queueBusy) return;
		queueBusy = true;
		try {
			const res = await fetch(`/api/playlists/${pl.id}/tracks`);
			if (!res.ok) return;
			const data = await res.json();
			for (const track of data.items ?? []) {
				player.addToQueue({
					id: track.id,
					title: track.title,
					artist: track.artist,
					username: track.username,
					uploaderName: track.uploaderName,
					durationMs: track.durationMs,
					bitrate: track.bitrate ?? null,
					sampleRate: track.sampleRate ?? null,
					channels: track.channels ?? null,
					codec: track.codec ?? null,
					hasCover: track.hasCover,
					waveform: track.waveform,
					likedByViewer: track.likedByViewer
				});
			}
		} finally {
			queueBusy = false;
			closeMenu();
		}
	}

	/** @param {PlaylistSummary} pl */
	async function deletePlaylist(pl) {
		if (deleteBusy) return;
		if (!confirm(`Delete “${pl.title}”? This cannot be undone.`)) {
			closeMenu();
			return;
		}
		deleteBusy = true;
		try {
			const res = await fetch(`/api/playlists/${pl.id}`, { method: 'DELETE' });
			if (res.ok) {
				if (player.isPlaylistCurrent(pl.id)) {
					player.evict(player.current?.id ?? '');
				}
				ondeleted?.(pl.id);
			}
		} finally {
			deleteBusy = false;
			closeMenu();
		}
	}

	/** @param {string} playlistId */
	function menuClickOutside(playlistId) {
		/** @type {import('svelte/attachments').Attachment} */
		return (node) => {
			/** @param {PointerEvent} event */
			function onPointerDown(event) {
				if (menuPlaylistId !== playlistId) return;
				const target = /** @type {Node | null} */ (event.target);
				if (target && !node.contains(target)) closeMenu();
			}
			document.addEventListener('pointerdown', onPointerDown);
			return () => document.removeEventListener('pointerdown', onPointerDown);
		};
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key === 'Escape' && menuPlaylistId != null) closeMenuAndRestoreFocus();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<nav class="media-nav" aria-label="Library media">
	<button
		type="button"
		class="nav-row"
		class:active={allMediaActive}
		aria-current={allMediaActive ? 'page' : undefined}
		onclick={() => onselect({ kind: 'all' })}
	>
		<span class="nav-icon" aria-hidden="true">
			<IconFolder size={16} stroke={1.75} />
		</span>
		<span class="nav-label">All Media</span>
	</button>

	<ul class="type-list" aria-label="Media types">
		{#each TRACK_MEDIA_TYPE_OPTIONS as option (option.value)}
			{@const Icon = MEDIA_TYPE_ICONS[option.value]}
			{@const active = activePlaylistId == null && activeMediaType === option.value}
			<li>
				<button
					type="button"
					class="nav-row nested"
					class:active
					aria-current={active ? 'page' : undefined}
					onclick={() => onselect({ kind: 'type', mediaType: option.value })}
				>
					<span class="nav-icon" aria-hidden="true">
						<Icon size={15} stroke={1.75} />
					</span>
					<span class="nav-label">{option.plural}</span>
				</button>
			</li>
		{/each}
	</ul>

	<div class="ruler" role="separator" aria-hidden="true"></div>

	<div class="playlists-head">
		<span class="eyebrow" id="library-playlists-label">Playlists</span>
		<button
			type="button"
			class="add-btn"
			aria-label="New playlist"
			title="New playlist"
			disabled={creating}
			onclick={startCreate}
		>
			<IconPlus size={15} stroke={2} aria-hidden="true" />
		</button>
	</div>

	{#if creating}
		<div class="create-row">
			<input
				bind:this={createInput}
				bind:value={createTitle}
				class="create-input"
				type="text"
				maxlength="200"
				placeholder="Playlist name"
				aria-label="Playlist name"
				aria-invalid={createError ? 'true' : undefined}
				aria-describedby={createError ? 'library-create-error' : undefined}
				disabled={createBusy}
				onkeydown={onCreateKeydown}
				onblur={() => {
					if (!createTitle.trim() && !createBusy) cancelCreate();
				}}
			/>
			{#if createError}
				<p id="library-create-error" class="create-error" role="alert" aria-live="polite">
					{createError}
				</p>
			{/if}
		</div>
	{/if}

	<ul
		class="playlist-list"
		class:menu-open={menuPlaylistId != null}
		aria-labelledby="library-playlists-label"
	>
		{#each playlists as pl (pl.id)}
			<li class:menu-open={menuPlaylistId === pl.id}>
				<button
					type="button"
					class="nav-row playlist-row"
					class:active={activePlaylistId === pl.id}
					aria-current={activePlaylistId === pl.id ? 'page' : undefined}
					onclick={() => onselect({ kind: 'playlist', playlistId: pl.id })}
				>
					<span class="nav-icon" aria-hidden="true">
						<IconPlaylist size={16} stroke={1.75} />
					</span>
					<span class="nav-label">{pl.title}</span>
					<span class="track-count">{pl.trackCount}</span>
				</button>

				<div class="menu-wrap" {@attach menuClickOutside(pl.id)}>
					<button
						type="button"
						class="more-btn"
						aria-label="More actions for {pl.title}"
						aria-expanded={menuPlaylistId === pl.id}
						aria-haspopup="menu"
						aria-controls="library-playlist-menu-{pl.id}"
						onclick={(event) => {
							event.stopPropagation();
							toggleMenu(pl.id, event.currentTarget);
						}}
					>
						<span class="more-icon" aria-hidden="true">
							<IconDots size={15} stroke={1.75} />
						</span>
					</button>

					{#if menuPlaylistId === pl.id}
						<div class="menu" id="library-playlist-menu-{pl.id}" role="menu">
							<a class="menu-item" role="menuitem" href="/playlists/{pl.id}">Open page</a>
							<a class="menu-item" role="menuitem" href="/playlists/{pl.id}/edit">Edit</a>
							<button type="button" role="menuitem" onclick={() => copyLink(pl)}>
								{copied ? 'Copied!' : 'Copy link'}
							</button>
							<button
								type="button"
								role="menuitem"
								disabled={queueBusy}
								onclick={() => addToNextUp(pl)}
							>
								Add to Next Up
							</button>
							<button
								type="button"
								role="menuitem"
								class="danger"
								disabled={deleteBusy}
								onclick={() => deletePlaylist(pl)}
							>
								Delete
							</button>
						</div>
					{/if}
				</div>
			</li>
		{/each}
	</ul>

	{#if playlists.length === 0 && !creating}
		<p class="empty-playlists">No playlists yet. Hit + to make one.</p>
	{/if}
</nav>

<style>
	.media-nav {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
		height: 100%;
		padding: 0.55rem 0.45rem;
	}

	.nav-row {
		display: grid;
		grid-template-columns: 1.1rem minmax(0, 1fr) auto;
		gap: 0.45rem;
		align-items: center;
		width: 100%;
		min-height: 2rem;
		padding: 0.35rem 0.45rem;
		border: 1px solid transparent;
		color: var(--ink);
		background: transparent;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-align: left;
		cursor: pointer;
	}

	.nav-row:hover {
		background: color-mix(in srgb, var(--ink) 5%, transparent);
	}

	.nav-row.active {
		border-color: var(--accent);
		color: var(--on-accent);
		background: var(--accent);
	}

	.nav-icon {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		color: var(--muted);
	}

	.nav-row.active .nav-icon,
	.nav-row.active .track-count {
		color: var(--on-accent);
	}

	.nav-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nav-row.nested {
		min-height: 1.75rem;
		padding-left: 1.15rem;
		font-size: 0.72rem;
		font-weight: 600;
	}

	.track-count {
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
	}

	.type-list {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.type-list li {
		min-width: 0;
	}

	.ruler {
		height: 1px;
		margin: 0.35rem 0.25rem 0.15rem;
		background: color-mix(in srgb, var(--muted) 45%, transparent);
	}

	.playlists-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.35rem;
		padding: 0.15rem 0.35rem 0.1rem;
	}

	.eyebrow {
		margin: 0;
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.add-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.55rem;
		height: 1.55rem;
		border: 1px solid var(--hard-border);
		color: var(--ink);
		background: var(--paper);
		box-shadow: 2px 2px 0 var(--hard-shadow);
		cursor: pointer;
	}

	.add-btn:hover:not(:disabled) {
		color: var(--on-accent);
		background: var(--accent);
	}

	.add-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.create-row {
		padding: 0.15rem 0.25rem 0.35rem;
	}

	.create-input {
		width: 100%;
		min-height: 2rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--field-border);
		border-radius: 0.125rem;
		color: var(--ink);
		background: var(--field-surface);
		font-size: 0.78rem;
		font-weight: 600;
	}

	.create-input:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.create-error {
		margin: 0.3rem 0 0;
		color: #c2321e;
		font-size: 0.68rem;
		line-height: 1.3;
	}

	.playlist-list {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		margin: 0;
		padding: 0;
		list-style: none;
		overflow: auto;
		min-height: 0;
	}

	/* Absolute menus are clipped by overflow:auto; unlock while open. */
	.playlist-list.menu-open {
		overflow: visible;
	}

	.playlist-list li {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 1.55rem;
		gap: 0.15rem;
		align-items: center;
	}

	.playlist-list li.menu-open {
		z-index: 40;
	}

	.playlist-row {
		min-width: 0;
	}

	.menu-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.more-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.55rem;
		height: 1.55rem;
		border: 0;
		color: var(--muted);
		background: transparent;
		cursor: pointer;
	}

	.more-btn:hover,
	.more-btn[aria-expanded='true'] {
		color: var(--ink);
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}

	.more-icon {
		display: flex;
	}

	.menu {
		position: absolute;
		top: calc(100% + 0.2rem);
		right: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		min-width: 10.5rem;
		padding: 0.2rem 0;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 4px 4px 0 var(--hard-shadow);
	}

	.menu button,
	.menu .menu-item {
		display: flex;
		width: 100%;
		align-items: center;
		padding: 0.5rem 0.65rem;
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

	.empty-playlists {
		margin: 0.35rem 0.45rem 0;
		color: var(--muted);
		font-size: 0.7rem;
		line-height: 1.35;
	}
</style>
