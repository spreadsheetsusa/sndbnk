<script>
	import { deserialize } from '$app/forms';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import IconList from '@tabler/icons-svelte-runes/icons/list';
	import IconUpload from '@tabler/icons-svelte-runes/icons/upload';
	import { MediaQuery } from 'svelte/reactivity';

	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import InfiniteList from '#lib/components/lists/InfiniteList.svelte';
	import HostedQuotaMeter from '#lib/components/library/HostedQuotaMeter.svelte';
	import LibraryDeck from '#lib/components/library/LibraryDeck.svelte';
	import LibraryMediaSidebar from '#lib/components/library/LibraryMediaSidebar.svelte';
	import LibraryTrackRow from '#lib/components/library/LibraryTrackRow.svelte';
	import { restorableList } from '#lib/lists/restorable-list.svelte.js';
	import { AUDIO_FILE_ACCEPT, isAudioFile } from '#lib/media/audio-accept.js';
	import { extractAudioMetadata } from '#lib/media/audio-metadata.js';
	import {
		DEFAULT_TRACK_MEDIA_TYPE,
		TRACK_MEDIA_TYPE_OPTIONS
	} from '#lib/media/track-media-type.js';
	import { player } from '#lib/player/player.svelte.js';

	let { data, form } = $props();

	/** @type {HTMLElement | undefined} */
	let container;
	/** @type {HTMLInputElement | undefined} */
	let uploadInput;

	const paged = restorableList(
		() => ({ scope: 'library', owner: data.user.id, mediaType: data.mediaType }),
		() => data,
		() => container
	);
	const libraryList = $derived(paged.current);

	export const snapshot = paged.snapshot;

	let uploading = $state(false);
	/** @type {string | null} */
	let uploadError = $state(null);
	/** @type {string | null} */
	let saveNotice = $state(null);
	let dropActive = $state(false);
	let dragDepth = 0;

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

	/** @type {PlaylistSummary[] | null} */
	let playlistOverride = $state(null);
	const playlists = $derived(playlistOverride ?? data.playlists);

	/** @type {string | null} */
	let activePlaylistId = $state(null);
	const activePlaylist = $derived(
		activePlaylistId ? (playlists.find((pl) => pl.id === activePlaylistId) ?? null) : null
	);

	/** @type {import('#lib/lists/track-list.svelte.js').ListItem[]} */
	let playlistItems = $state([]);
	let playlistLoading = $state(false);
	/** @type {string | null} */
	let playlistError = $state(null);
	/** Tracks which playlist `playlistItems` belongs to. */
	let loadedPlaylistId = $state(/** @type {string | null} */ (null));

	const isMobile = new MediaQuery('(max-width: 960px)', false);
	let mediaOpen = $state(false);

	/** @type {string | null} */
	let selectedId = $state(null);
	let editing = $state(false);
	/** Last href we applied so replaceState and external navigations do not fight. */
	let appliedHref = '';

	const visibleItems = $derived(activePlaylistId == null ? libraryList.items : playlistItems);
	const resolvedId = $derived(
		selectedId && visibleItems.some((track) => track.id === selectedId)
			? selectedId
			: (visibleItems[0]?.id ?? null)
	);
	const selected = $derived(visibleItems.find((track) => track.id === resolvedId) ?? null);

	const activeMediaPlural = $derived(
		data.mediaType
			? (TRACK_MEDIA_TYPE_OPTIONS.find((option) => option.value === data.mediaType)?.plural ?? null)
			: null
	);
	const sourceLabel = $derived(activePlaylist?.title ?? activeMediaPlural ?? 'All Media');
	const emptyLibraryCopy = $derived(
		activeMediaPlural
			? `No ${activeMediaPlural.toLowerCase()} yet.`
			: 'No tracks yet. Drop an audio file here or use Upload.'
	);

	// Seed / resync from the address bar (full loads, back/forward, TrackCard links).
	$effect(() => {
		const href = page.url.href;
		if (href === appliedHref) return;
		appliedHref = href;
		const track = page.url.searchParams.get('track');
		selectedId = track;
		editing = page.url.searchParams.get('edit') === '1' && Boolean(track);
	});

	/**
	 * @param {{ trackId?: string | null, edit?: boolean }} opts
	 */
	function syncLibraryUrl({ trackId = null, edit = false } = {}) {
		selectedId = trackId;
		editing = Boolean(edit && trackId);

		const params = new URLSearchParams(page.url.searchParams);
		if (trackId) params.set('track', trackId);
		else params.delete('track');
		if (edit && trackId) params.set('edit', '1');
		else params.delete('edit');
		const qs = params.toString();
		const next = qs ? `${page.url.pathname}?${qs}` : page.url.pathname;
		const current = `${page.url.pathname}${page.url.search}`;
		appliedHref = new URL(next, page.url.origin).href;
		if (next !== current) replaceState(next, page.state);
	}

	/** @param {string} trackId */
	function selectTrack(trackId) {
		syncLibraryUrl({ trackId, edit: false });
	}

	/** @param {string} trackId */
	function startEdit(trackId) {
		syncLibraryUrl({ trackId, edit: true });
	}

	function cancelEdit() {
		syncLibraryUrl({ trackId: selectedId ?? resolvedId, edit: false });
	}

	/**
	 * @param {Record<string, unknown>} patch
	 */
	function mergeTrackPatch(patch) {
		const id = typeof patch.id === 'string' ? patch.id : null;
		if (!id) return null;

		/**
		 * @param {import('#lib/lists/track-list.svelte.js').ListItem} item
		 */
		const merge = (item) => (item.id === id ? { ...item, ...patch } : item);

		if (activePlaylistId == null) {
			libraryList.items = libraryList.items.map(merge);
		} else {
			playlistItems = playlistItems.map(merge);
		}
		return id;
	}

	/**
	 * @param {Record<string, unknown>} patch
	 */
	function applyTrackPatch(patch) {
		const id = mergeTrackPatch(patch);
		saveNotice = typeof patch.tagsMessage === 'string' ? patch.tagsMessage : null;
		if (id) syncLibraryUrl({ trackId: id, edit: false });
	}

	/**
	 * @param {string | null} mediaType
	 * @param {{ clearTrack?: boolean }} [opts]
	 */
	async function setLibraryMediaType(mediaType, { clearTrack = true } = {}) {
		const params = new URLSearchParams(page.url.searchParams);
		if (mediaType) params.set('mediaType', mediaType);
		else params.delete('mediaType');
		if (clearTrack) {
			params.delete('track');
			params.delete('edit');
			selectedId = null;
			editing = false;
		}
		const qs = params.toString();
		const next = qs ? `${page.url.pathname}?${qs}` : page.url.pathname;
		const current = `${page.url.pathname}${page.url.search}`;
		if (next === current) return;
		appliedHref = new URL(next, page.url.origin).href;
		await goto(next, { keepFocus: true, noScroll: true, replaceState: true });
	}

	/**
	 * @param {LibrarySource} source
	 */
	async function selectSource(source) {
		if (isMobile.current) mediaOpen = false;

		if (source.kind === 'playlist') {
			const playlistId = source.playlistId;
			activePlaylistId = playlistId;
			if (data.mediaType) await setLibraryMediaType(null, { clearTrack: false });

			if (loadedPlaylistId === playlistId && !playlistError) return;

			playlistLoading = true;
			playlistError = null;
			playlistItems = [];
			loadedPlaylistId = playlistId;
			try {
				const res = await fetch(`/api/playlists/${playlistId}/tracks`);
				if (!res.ok) {
					playlistError = 'Could not load playlist tracks.';
					playlistItems = [];
					return;
				}
				const body = await res.json();
				if (activePlaylistId !== playlistId) return;
				playlistItems = body.items ?? [];
			} catch {
				if (activePlaylistId !== playlistId) return;
				playlistError = 'Could not load playlist tracks.';
				playlistItems = [];
			} finally {
				if (loadedPlaylistId === playlistId) playlistLoading = false;
			}
			return;
		}

		activePlaylistId = null;
		playlistError = null;

		if (source.kind === 'all') {
			if (data.mediaType) await setLibraryMediaType(null);
			return;
		}

		if (data.mediaType !== source.mediaType) {
			await setLibraryMediaType(source.mediaType);
		}
	}

	/** @param {PlaylistSummary} playlist */
	function handleCreated(playlist) {
		playlistOverride = [playlist, ...(playlistOverride ?? data.playlists)];
		loadedPlaylistId = playlist.id;
		playlistItems = [];
		playlistError = null;
		playlistLoading = false;
	}

	/** @param {string} playlistId */
	function handleDeleted(playlistId) {
		playlistOverride = (playlistOverride ?? data.playlists).filter((pl) => pl.id !== playlistId);
		if (activePlaylistId === playlistId) {
			activePlaylistId = null;
			loadedPlaylistId = null;
			playlistItems = [];
			playlistError = null;
		}
	}

	/** @param {KeyboardEvent} event */
	function handleWindowKeydown(event) {
		if (event.key === 'Escape') {
			if (editing) {
				cancelEdit();
				return;
			}
			if (mediaOpen && isMobile.current) {
				mediaOpen = false;
			}
		}
	}

	/** @param {DataTransfer | null | undefined} dt */
	function hasFileDrag(dt) {
		return Boolean(dt?.types?.includes('Files'));
	}

	/** @param {DragEvent} event */
	function onPageDragEnter(event) {
		if (!hasFileDrag(event.dataTransfer)) return;
		event.preventDefault();
		dragDepth += 1;
		dropActive = true;
	}

	/** @param {DragEvent} event */
	function onPageDragOver(event) {
		if (!hasFileDrag(event.dataTransfer)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		dropActive = true;
	}

	/** @param {DragEvent} event */
	function onPageDragLeave(event) {
		if (!hasFileDrag(event.dataTransfer)) return;
		event.preventDefault();
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) dropActive = false;
	}

	/** @param {DragEvent} event */
	function onPageDrop(event) {
		event.preventDefault();
		dragDepth = 0;
		dropActive = false;
		const file = [...(event.dataTransfer?.files ?? [])].find(isAudioFile) ?? null;
		if (file) void uploadAudioFile(file);
	}

	function openUploadPicker() {
		uploadInput?.click();
	}

	/** @param {Event} event */
	function onUploadPick(event) {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		const file = input.files?.[0] ?? null;
		input.value = '';
		if (file && isAudioFile(file)) void uploadAudioFile(file);
	}

	/**
	 * @param {File} file
	 */
	async function uploadAudioFile(file) {
		if (uploading) return;
		uploading = true;
		uploadError = null;
		saveNotice = null;

		try {
			const meta = await extractAudioMetadata(file);
			const body = new FormData();
			body.set('audio', file);
			body.set('title', meta.fields.title ?? file.name);
			body.set('description', meta.fields.description ?? '');
			body.set('artist', meta.fields.artist ?? '');
			body.set('album', meta.fields.album ?? '');
			body.set('genre', meta.fields.genre ?? '');
			body.set('mediaType', DEFAULT_TRACK_MEDIA_TYPE);
			body.set('year', meta.fields.year ?? '');
			body.set('trackNumber', meta.fields.trackNumber ?? '');
			body.set('bpm', meta.fields.bpm ?? '');
			body.set('isrc', meta.fields.isrc ?? '');
			body.set('comment', meta.fields.comment ?? '');
			body.set('durationMs', meta.technical.durationMs ?? '');
			body.set('bitrate', meta.technical.bitrate ?? '');
			body.set('sampleRate', meta.technical.sampleRate ?? '');
			body.set('channels', meta.technical.channels ?? '');
			body.set('codec', meta.technical.codec ?? '');
			body.set('encoder', meta.technical.encoder ?? '');
			body.set('tagTypes', meta.technical.tagTypes ?? '');
			body.set('trackGainDb', meta.technical.trackGainDb ?? '');
			body.set('container', meta.technical.container ?? '');
			if (meta.cover) body.set('cover', meta.cover);

			const res = await fetch('?/create', { method: 'POST', body });
			const result = deserialize(await res.text());

			if (result.type === 'failure') {
				const message =
					typeof result.data?.message === 'string' ? result.data.message : 'Upload failed.';
				uploadError = message;
				return;
			}
			if (result.type !== 'success' || !result.data) {
				uploadError = 'Upload failed.';
				return;
			}

			const item = /** @type {import('#lib/lists/track-list.svelte.js').ListItem | undefined} */ (
				result.data.item
			);
			if (!item?.id) {
				uploadError = 'Upload succeeded but the track could not be loaded.';
				return;
			}

			activePlaylistId = null;
			playlistError = null;

			const needsAllMedia =
				Boolean(data.mediaType) && item.mediaType && item.mediaType !== data.mediaType;
			if (needsAllMedia) {
				await setLibraryMediaType(null, { clearTrack: false });
			}

			libraryList.prependItem(item);
			syncLibraryUrl({ trackId: item.id, edit: true });
			player.play(item);
		} catch {
			uploadError = 'Upload failed. Try again.';
		} finally {
			uploading = false;
		}
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<svelte:head>
	<title>Music Library | SNDBNK</title>
	<meta name="description" content="Your private SNDBNK track library." />
	<meta name="robots" content="noindex" />
</svelte:head>

<div
	class="library-page"
	class:drop-active={dropActive}
	role="region"
	aria-label="Music library. Drop an audio file anywhere to upload."
	ondragenter={onPageDragEnter}
	ondragover={onPageDragOver}
	ondragleave={onPageDragLeave}
	ondrop={onPageDrop}
>
	{#if dropActive}
		<div class="drop-veil" aria-hidden="true">
			<p class="drop-veil-copy">{uploading ? 'Uploading…' : 'Drop audio to upload'}</p>
		</div>
	{/if}

	<input
		bind:this={uploadInput}
		class="upload-input"
		type="file"
		accept={AUDIO_FILE_ACCEPT}
		onchange={onUploadPick}
	/>

	<SiteHeader />

	<main>
		<header class="page-head">
			<div class="page-head-copy">
				<p class="eyebrow eyebrow-chip accent-text">@{data.profile.username}</p>
				<h1 id="tracks-heading" class="display-face">
					<span class="title-music">Music&nbsp;</span>Library
				</h1>
			</div>
			<div class="page-head-actions">
				{#if data.usage.maxLocalBytes !== null}
					<div class="page-head-quota">
						<HostedQuotaMeter
							localBytes={data.usage.localBytes}
							maxLocalBytes={data.usage.maxLocalBytes}
							planLabel={data.usage.planLabel}
						/>
					</div>
				{/if}
				<button class="pressable" type="button" disabled={uploading} onclick={openUploadPicker}>
					<IconUpload size={16} stroke={1.75} aria-hidden="true" />
					{uploading ? 'Uploading…' : 'Upload'}
				</button>
			</div>
		</header>

		{#if uploadError && !uploading}
			<p class="upload-error" role="alert" aria-live="polite">{uploadError}</p>
		{:else if saveNotice}
			<p class="save-notice" role="status" aria-live="polite">{saveNotice}</p>
		{/if}

		<LibraryDeck
			track={selected}
			visualizerBackdrop
			{editing}
			{form}
			onedit={() => {
				if (resolvedId) startEdit(resolvedId);
			}}
			oncancel={cancelEdit}
			onupdated={applyTrackPatch}
			onpublished={(published) => {
				if (resolvedId) mergeTrackPatch({ id: resolvedId, published });
			}}
		/>

		<section class="block" aria-labelledby="tracks-heading">
			<div class="media-shell" class:overlay-open={mediaOpen}>
				{#if isMobile.current && mediaOpen}
					<button
						type="button"
						class="media-scrim"
						aria-label="Close media browser"
						onclick={() => (mediaOpen = false)}
					></button>
				{/if}

				<aside
					id="library-media-nav"
					class="media-aside"
					class:open={mediaOpen || !isMobile.current}
					aria-hidden={isMobile.current && !mediaOpen ? 'true' : undefined}
				>
					<LibraryMediaSidebar
						{playlists}
						{activePlaylistId}
						activeMediaType={data.mediaType}
						onselect={selectSource}
						oncreated={handleCreated}
						ondeleted={handleDeleted}
					/>
				</aside>

				<div class="media-main" bind:this={container}>
					<div class="media-toolbar">
						<button
							type="button"
							class="media-toggle"
							aria-expanded={mediaOpen}
							aria-controls="library-media-nav"
							onclick={() => (mediaOpen = !mediaOpen)}
						>
							<IconList size={16} stroke={1.75} aria-hidden="true" />
							<span class="media-toggle-label">{sourceLabel}</span>
						</button>
						{#if activePlaylist}
							<a class="edit-link" href="/playlists/{activePlaylist.id}/edit">Edit playlist</a>
						{/if}
					</div>

					{#if activePlaylistId == null}
						{#if libraryList.items.length === 0}
							<div class="empty" aria-live="polite">
								<p>{emptyLibraryCopy}</p>
								<button
									class="pressable"
									type="button"
									disabled={uploading}
									onclick={openUploadPicker}
								>
									<IconUpload size={16} stroke={1.75} aria-hidden="true" />
									{uploading ? 'Uploading…' : 'Upload'}
								</button>
							</div>
						{:else}
							<InfiniteList list={libraryList}>
								<div class="track-table">
									<div class="table-head" aria-hidden="true">
										<span></span>
										<span></span>
										<span>Track</span>
										<span class="col-genre">Genre</span>
										<span class="col-duration">Time</span>
										<span class="col-stats">Activity</span>
										<span class="col-added">Added</span>
										<span></span>
									</div>
									<ul>
										{#each libraryList.items as track (track.id)}
											<li data-cursor={track.cursor}>
												<LibraryTrackRow
													{track}
													selected={track.id === resolvedId}
													onselect={() => selectTrack(track.id)}
													onedit={() => startEdit(track.id)}
													ondeleted={() => libraryList.remove(track.id)}
												/>
											</li>
										{/each}
									</ul>
								</div>
							</InfiniteList>
						{/if}
					{:else if playlistLoading}
						<div class="empty" aria-live="polite">
							<p>Loading playlist…</p>
						</div>
					{:else if playlistError}
						<div class="empty" aria-live="polite">
							<p>{playlistError}</p>
							<button
								type="button"
								class="pressable secondary"
								onclick={() =>
									activePlaylistId &&
									selectSource({ kind: 'playlist', playlistId: activePlaylistId })}
							>
								Retry
							</button>
						</div>
					{:else if playlistItems.length === 0}
						<div class="empty" aria-live="polite">
							<p>No tracks in this playlist yet.</p>
							{#if activePlaylist}
								<a class="pressable secondary" href="/playlists/{activePlaylist.id}/edit">
									Edit playlist
								</a>
							{/if}
						</div>
					{:else}
						<div class="track-table">
							<div class="table-head" aria-hidden="true">
								<span></span>
								<span></span>
								<span>Track</span>
								<span class="col-genre">Genre</span>
								<span class="col-duration">Time</span>
								<span class="col-stats">Activity</span>
								<span class="col-added">Added</span>
								<span></span>
							</div>
							<ul>
								{#each playlistItems as track (track.id)}
									<li>
										<LibraryTrackRow
											{track}
											selected={track.id === resolvedId}
											onselect={() => selectTrack(track.id)}
											onedit={() => startEdit(track.id)}
											ondeleted={() => {
												playlistItems = playlistItems.filter((item) => item.id !== track.id);
												if (playlistOverride) {
													playlistOverride = playlistOverride.map((pl) =>
														pl.id === activePlaylistId
															? { ...pl, trackCount: Math.max(0, pl.trackCount - 1) }
															: pl
													);
												} else {
													playlistOverride = data.playlists.map((pl) =>
														pl.id === activePlaylistId
															? { ...pl, trackCount: Math.max(0, pl.trackCount - 1) }
															: pl
													);
												}
											}}
										/>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</div>
		</section>
	</main>

	<SiteFooter bordered />
</div>

<style>
	.library-page {
		position: relative;
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 4rem;
	}

	.upload-input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.drop-veil {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		pointer-events: none;
		background: color-mix(in srgb, var(--paper) 72%, transparent);
		border: 2px dashed var(--accent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent);
	}

	.drop-veil-copy {
		margin: 0;
		padding: 0.75rem 1.1rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		box-shadow: 4px 4px 0 var(--hard-shadow);
		font-family: var(--font-lcd);
		font-size: 1.35rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.upload-error,
	.save-notice {
		margin: 0;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--ink);
		background: color-mix(in srgb, var(--accent) 14%, var(--paper));
		color: var(--ink);
		font-size: 0.9rem;
	}

	main {
		display: grid;
		gap: 1rem;
		width: min(100%, var(--site-content-max-wide));
		margin: 0 auto;
		padding-top: clamp(0.75rem, 2vw, 1.25rem);
	}

	.page-head {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem 1rem;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.35rem;
	}

	.page-head-copy {
		min-width: 0;
		flex: 1 1 auto;
	}

	.page-head-actions {
		display: flex;
		flex-wrap: wrap;
		flex-shrink: 0;
		gap: 0.5rem;
		align-items: center;
		justify-content: flex-end;
		margin-left: auto;
	}

	.page-head-copy > .eyebrow {
		margin: 0 0 0.2rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(1rem, 2.2vw, 1.25rem);
		line-height: 1.15;
		animation: rise 0.65s ease both;
	}

	.title-music {
		display: none;
	}

	@media (min-width: 768px) {
		.title-music {
			display: inline;
		}
	}

	.page-head-actions .pressable {
		min-height: 2.35rem;
		padding: 0 0.9rem;
		box-shadow: 3px 3px 0 var(--hard-shadow);
	}

	/* Secondary pressable chrome so the meter reads as a sibling control. */
	.page-head-quota {
		display: flex;
		flex-direction: column;
		justify-content: center;
		box-sizing: border-box;
		min-width: 9rem;
		max-width: 13rem;
		min-height: 2.35rem;
		padding: 0.25rem 0.7rem;
		border: 1px solid var(--ink);
		color: var(--ink);
		background: var(--paper);
		box-shadow: 3px 3px 0 var(--hard-shadow);
	}

	.page-head-quota :global(.quota-meter) {
		width: auto;
		min-width: 0;
		max-width: none;
		animation: none;
	}

	.page-head-quota :global(.meter-head) {
		gap: 0.55rem;
		margin-bottom: 0.15rem;
	}

	.page-head-quota :global(.meter-label),
	.page-head-quota :global(.meter-value) {
		font-size: 0.62rem;
	}

	.page-head-quota :global(.meter-track) {
		height: 0.35rem;
	}

	.page-head-quota :global(.quota-upsell) {
		max-width: none;
		font-size: 0.65rem;
		line-height: 1.3;
		text-align: left;
		animation: none;
	}

	.block {
		margin-top: 0.5rem;
		background: var(--paper);
		animation: rise 0.8s ease both;
	}

	.media-shell {
		position: relative;
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		gap: 0;
		align-items: stretch;
		min-height: 12rem;
		border: 1px solid color-mix(in srgb, var(--hard-border) 72%, black);
		background: color-mix(in srgb, var(--paper) 86%, black);
		box-shadow: 5px 5px 0 color-mix(in srgb, var(--hard-shadow) 70%, black);
		/* Visible so row/playlist menus can escape the chrome; mobile
		   re-clips for the sliding panel, then unlocks while a menu is open. */
		overflow: visible;
	}

	.media-aside {
		min-width: 0;
		border-right: 1px solid color-mix(in srgb, var(--hard-border) 72%, black);
		background: color-mix(in srgb, var(--ink) 7%, var(--paper));
	}

	/* Playlist ellipsis menus open outside the aside scrollport; keep them
	   above the track table and unclipped while expanded. */
	.media-aside:has(:global(.more-btn[aria-expanded='true'])) {
		z-index: 6;
		overflow: visible;
	}

	:global(.dark) .media-aside {
		background: color-mix(in srgb, var(--accent) 2%, #050505);
	}

	.media-main {
		min-width: 0;
		background: var(--paper);
	}

	.media-toolbar {
		display: none;
		gap: 0.65rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.45rem 0.55rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.media-toggle {
		display: inline-flex;
		gap: 0.45rem;
		align-items: center;
		min-width: 0;
		min-height: 2.4rem;
		padding: 0.35rem 0.65rem;
		border: 1px solid var(--hard-border);
		color: var(--ink);
		background: var(--paper);
		box-shadow: 2px 2px 0 var(--hard-shadow);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.media-toggle[aria-expanded='true'] {
		box-shadow: inset 2px 2px 0 color-mix(in srgb, var(--ink) 30%, transparent);
	}

	.media-toggle-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.edit-link {
		flex-shrink: 0;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}

	.edit-link:hover {
		color: var(--accent);
	}

	.media-scrim {
		display: none;
	}

	.pressable {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
		justify-content: center;
		width: fit-content;
		min-height: 3.1rem;
		padding: 0 1.1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
	}

	.pressable.secondary {
		color: var(--ink);
		background: var(--paper);
	}

	.empty {
		padding: 1.25rem;
		border: 1px dashed color-mix(in srgb, var(--ink) 35%, transparent);
		margin: 0.75rem;
	}

	.empty p {
		margin: 0 0 1rem;
		color: var(--muted);
		line-height: 1.5;
	}

	/* Shared by the header strip and every row so the columns cannot drift apart. */
	.track-table {
		--library-grid: 1.7rem 1.75rem minmax(0, 1fr) minmax(0, 8rem) 4rem 5.5rem 6rem 1.7rem;
	}

	.table-head {
		display: grid;
		grid-template-columns: var(--library-grid);
		gap: 0.6rem;
		align-items: center;
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 25%, transparent);
		color: var(--muted);
		background: color-mix(in srgb, var(--ink) 7%, var(--paper));
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	:global(.dark) .table-head {
		background: color-mix(in srgb, var(--accent) 2%, #050505);
	}

	.table-head .col-duration {
		text-align: right;
	}

	.track-table ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Rows off-screen skip layout and paint; `auto` remembers each measured
	   height so scrolling back up lands where it should. */
	.track-table li {
		content-visibility: auto;
		contain-intrinsic-size: auto 2.6rem;
	}

	/* `content-visibility: auto` paint-contains the row and clips the absolute
	   menu; drop containment for the open row and stack it above neighbors.
	   `.more-btn` is in LibraryTrackRow, so it must be `:global` here. */
	.track-table li:has(:global(.more-btn[aria-expanded='true'])) {
		position: relative;
		z-index: 6;
		content-visibility: visible;
	}

	@media (max-width: 960px) {
		.media-shell {
			grid-template-columns: minmax(0, 1fr);
			overflow: hidden;
		}

		.media-shell:has(:global(.more-btn[aria-expanded='true'])) {
			overflow: visible;
		}

		.media-toolbar {
			display: flex;
		}

		.media-aside {
			position: absolute;
			top: 0;
			bottom: 0;
			left: 0;
			z-index: 5;
			width: min(16.5rem, 84%);
			border-right: 1px solid color-mix(in srgb, var(--hard-border) 72%, black);
			box-shadow: 6px 0 0 color-mix(in srgb, var(--hard-shadow) 70%, black);
			transform: translateX(-105%);
			visibility: hidden;
			pointer-events: none;
			transition:
				transform 0.22s ease,
				visibility 0.22s;
		}

		.media-aside.open {
			transform: translateX(0);
			visibility: visible;
			pointer-events: auto;
		}

		.media-scrim {
			display: block;
			position: absolute;
			inset: 0;
			z-index: 4;
			border: 0;
			background: color-mix(in srgb, var(--ink) 28%, transparent);
			cursor: pointer;
		}

		.track-table {
			--library-grid: 1.7rem 1.75rem minmax(0, 1fr) minmax(0, 8rem) 4rem 1.7rem;
		}

		.table-head .col-stats,
		.table-head .col-added {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.media-aside {
			transition: none;
		}
	}

	@media (max-width: 640px) {
		main {
			padding-top: 0.5rem;
		}

		.page-head {
			gap: 0.5rem 0.75rem;
		}

		.page-head-copy {
			flex: 1 1 0;
			min-width: 0;
		}

		.page-head-copy > .eyebrow {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.page-head-actions {
			gap: 0.4rem;
		}

		.page-head-actions .pressable {
			min-height: 2.2rem;
			padding: 0 0.7rem;
		}

		.page-head-quota {
			min-width: 7.5rem;
			max-width: 10.5rem;
			min-height: 2.2rem;
			padding: 0.2rem 0.5rem;
		}

		.table-head {
			display: none;
		}

		.track-table li {
			contain-intrinsic-size: auto 3.25rem;
		}
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
