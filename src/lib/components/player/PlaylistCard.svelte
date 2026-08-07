<script>
	import IconDots from '@tabler/icons-svelte-runes/icons/dots';
	import IconPlayerPauseFilled from '@tabler/icons-svelte-runes/icons/player-pause-filled';
	import IconPlayerPlayFilled from '@tabler/icons-svelte-runes/icons/player-play-filled';
	import IconArrowUp from '@tabler/icons-svelte-runes/icons/arrow-up';
	import IconPlaylist from '@tabler/icons-svelte-runes/icons/playlist';
	import { fade } from 'svelte/transition';

	import Avatar from '#lib/components/Avatar.svelte';
	import CoverArt from '#lib/components/CoverArt.svelte';
	import Waveform from '#lib/components/player/Waveform.svelte';
	import { whileNearViewport } from '#lib/lists/infinite-scroll.js';
	import { player } from '#lib/player/player.svelte.js';
	import { formatDuration } from '#lib/media/audio-metadata.js';
	import { relativeTime } from '#lib/relative-time.js';

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

	/**
	 * @typedef {Object} PlaylistMember
	 * @property {string} id
	 * @property {string} title
	 * @property {string | null} artist
	 * @property {string | null} username
	 * @property {string} uploaderName
	 * @property {number | null} durationMs
	 * @property {boolean} hasCover
	 * @property {number[] | null} waveform
	 * @property {number} likeCount
	 * @property {number} commentCount
	 * @property {boolean} likedByViewer
	 * @property {boolean} isOwner
	 * @property {TimedComment[] | undefined} [timedComments]
	 */

	/**
	 * @typedef {Object} CardPlaylist
	 * @property {string} id
	 * @property {string} title
	 * @property {string | null} description
	 * @property {boolean} published
	 * @property {boolean} hasCover
	 * @property {string | null} coverTrackId
	 * @property {number} createdAt
	 * @property {string} [cursor]
	 * @property {string | null} username
	 * @property {string} uploaderName
	 * @property {boolean} isOwner
	 * @property {number} likeCount
	 * @property {boolean} likedByViewer
	 * @property {number} trackCount
	 * @property {number} durationMs
	 * @property {PlaylistMember[]} tracks
	 */

	/**
	 * @type {{
	 *   playlist: CardPlaylist,
	 *   signedIn?: boolean,
	 *   viewerName?: string | null,
	 *   viewerImage?: string | null,
	 *   showCommentForm?: boolean,
	 *   linkBase?: string,
	 *   titleAsHeading?: boolean,
	 *   ondeleted?: () => void
	 * }}
	 */
	let {
		playlist,
		signedIn = false,
		viewerName = null,
		viewerImage = null,
		showCommentForm = true,
		linkBase = '',
		titleAsHeading = false,
		ondeleted
	} = $props();

	/** @type {{ liked: boolean, count: number } | null} */
	let likeOverride = $state(null);
	const liked = $derived(likeOverride?.liked ?? playlist.likedByViewer);
	const likeCount = $derived(likeOverride?.count ?? playlist.likeCount);

	let selectedIndex = $state(0);

	const activeIndex = $derived.by(() => {
		if (player.isPlaylistCurrent(playlist.id) && player.current) {
			const idx = playlist.tracks.findIndex((t) => t.id === player.current?.id);
			if (idx >= 0) return idx;
		}
		return Math.min(selectedIndex, Math.max(playlist.tracks.length - 1, 0));
	});

	const activeTrack = $derived(playlist.tracks[activeIndex] ?? null);

	const coverTrackId = $derived(
		playlist.coverTrackId ?? playlist.tracks.find((t) => t.hasCover)?.id ?? null
	);

	let commentBody = $state('');
	let commentBusy = $state(false);
	/** @type {string | null} */
	let commentNote = $state(null);
	/** @type {HTMLTextAreaElement | null} */
	let commentField = $state(null);

	const COMMENT_FIELD_MAX_LINES = 4;

	function resizeCommentField() {
		const el = commentField;
		if (!el) return;
		el.style.height = 'auto';
		const styles = getComputedStyle(el);
		const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
		const line = parseFloat(styles.lineHeight) || 18;
		const min = parseFloat(styles.minHeight) || padY + line;
		const max = padY + line * COMMENT_FIELD_MAX_LINES;
		const content = el.scrollHeight;
		el.style.height = `${Math.min(Math.max(content, min), max)}px`;
		el.style.overflowY = content > max ? 'auto' : 'hidden';
	}

	/** @param {KeyboardEvent} event */
	function onCommentKeydown(event) {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		/** @type {HTMLTextAreaElement} */ (event.currentTarget).form?.requestSubmit();
	}

	/** Track id that `postedComments` markers belong to; reset when the target changes. */
	let commentTrackId = $state(/** @type {string | null} */ (null));

	/** @type {TimedComment[]} */
	let postedComments = $state([]);

	let menuOpen = $state(false);
	/** @type {HTMLButtonElement | null} */
	let moreBtn = $state(null);
	let copied = $state(false);
	let likeBusy = $state(false);
	let deleteBusy = $state(false);
	/** @type {number | null} */
	let scrubSeconds = $state(null);

	const playlistActive = $derived(player.isPlaylistCurrent(playlist.id));
	const isActive = $derived(playlistActive && activeTrack && player.isCurrent(activeTrack.id));
	const isPlaying = $derived(Boolean(isActive && player.playing));
	const cardTime = $derived(isActive ? player.currentTime : 0);

	let nearViewport = $state(false);
	const showWaveform = $derived(nearViewport || Boolean(isActive));
	const displayTime = $derived(scrubSeconds ?? cardTime);
	const durationSec = $derived((activeTrack?.durationMs ?? 0) / 1000);
	const progressPct = $derived(
		durationSec > 0 ? Math.min((displayTime / durationSec) * 100, 100) : 0
	);
	const durationMs = $derived(activeTrack?.durationMs ?? 0);

	const markers = $derived.by(() => {
		if (!activeTrack || durationMs <= 0) return [];
		const seen = new Set(postedComments.map((c) => c.id));
		const all = [
			...(activeTrack.timedComments ?? []).filter((c) => !seen.has(c.id)),
			...postedComments
		];
		return all
			.slice()
			.sort((a, b) => a.atMs - b.atMs)
			.map((comment) => ({
				...comment,
				leftPct: Math.min(Math.max((comment.atMs / durationMs) * 100, 0), 100)
			}));
	});

	const tooltipWindowMs = $derived(Math.min(Math.max(durationMs * 0.01, 1000), 4000));

	const playheadMarker = $derived.by(() => {
		if (markers.length === 0 || (!isActive && scrubSeconds == null)) return null;
		const nowMs = displayTime * 1000;
		let closest = null;
		let closestDelta = Infinity;
		for (const marker of markers) {
			const delta = Math.abs(nowMs - marker.atMs);
			if (delta <= tooltipWindowMs && delta < closestDelta) {
				closest = marker;
				closestDelta = delta;
			}
		}
		return closest;
	});

	/** @type {string | null} */
	let hoveredMarkerId = $state(null);
	const activeMarker = $derived(
		markers.find((marker) => marker.id === hoveredMarkerId) ?? playheadMarker
	);

	/** @returns {import('#lib/player/player.svelte.js').PlayerTrack[]} */
	function asPlayerTracks() {
		return playlist.tracks.map((t) => ({
			id: t.id,
			title: t.title,
			artist: t.artist,
			username: t.username,
			uploaderName: t.uploaderName,
			mediaType: t.mediaType ?? 'track',
			durationMs: t.durationMs,
			bitrate: t.bitrate ?? null,
			sampleRate: t.sampleRate ?? null,
			channels: t.channels ?? null,
			codec: t.codec ?? null,
			hasCover: t.hasCover,
			waveform: t.waveform,
			likedByViewer: t.likedByViewer,
			playCount: t.playCount ?? 0
		}));
	}

	function togglePlay() {
		if (!activeTrack) return;
		if (isActive) {
			player.toggle();
			return;
		}
		selectedIndex = activeIndex;
		player.playFromPlaylist(playlist.id, asPlayerTracks(), activeIndex);
	}

	/** @param {number} index */
	function playAt(index) {
		if (!playlist.tracks[index]) return;
		selectedIndex = index;
		postedComments = [];
		commentTrackId = null;
		player.playFromPlaylist(playlist.id, asPlayerTracks(), index);
	}

	/** @param {number} seconds */
	function handleSeek(seconds) {
		if (!activeTrack) return;
		if (isActive) {
			player.seek(seconds);
			player.resume();
		} else {
			selectedIndex = activeIndex;
			player.playFromPlaylist(playlist.id, asPlayerTracks(), activeIndex, seconds);
		}
	}

	async function copyLink() {
		const url = `${location.origin}/playlists/${playlist.id}`;
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard unavailable.
		}
	}

	async function toggleLike() {
		if (!signedIn || likeBusy) return;
		likeBusy = true;
		try {
			const res = await fetch(`/api/playlists/${playlist.id}/like`, { method: 'POST' });
			if (res.ok) {
				const data = await res.json();
				likeOverride = { liked: data.liked, count: data.likeCount };
			}
		} finally {
			likeBusy = false;
			menuOpen = false;
		}
	}

	async function deletePlaylist() {
		if (deleteBusy) return;
		if (!confirm(`Delete “${playlist.title}”? This cannot be undone.`)) {
			menuOpen = false;
			return;
		}
		deleteBusy = true;
		try {
			const res = await fetch(`/api/playlists/${playlist.id}`, { method: 'DELETE' });
			if (res.ok) {
				if (player.isPlaylistCurrent(playlist.id)) {
					player.evict(player.current?.id ?? '');
				}
				ondeleted?.();
			}
		} finally {
			deleteBusy = false;
			menuOpen = false;
		}
	}

	/** @param {SubmitEvent} event */
	async function submitComment(event) {
		event.preventDefault();
		const body = commentBody.trim();
		if (!body || commentBusy || !activeTrack) return;

		const atMs = isActive && player.currentTime > 0 ? Math.round(player.currentTime * 1000) : null;
		const trackId = activeTrack.id;

		commentBusy = true;
		try {
			const res = await fetch(`/api/tracks/${trackId}/comments`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ body, atMs })
			});
			if (res.ok) {
				const data = await res.json();
				commentBody = '';
				if (commentTrackId !== trackId) {
					commentTrackId = trackId;
					postedComments = [];
				}
				if (data.comment.atMs != null) {
					postedComments = [...postedComments, data.comment];
				}
				commentNote =
					data.comment.atMs != null
						? `Comment added at ${formatDuration(data.comment.atMs)}`
						: 'Comment added';
				setTimeout(() => (commentNote = null), 2500);
				queueMicrotask(resizeCommentField);
			}
		} finally {
			commentBusy = false;
		}
	}

	/** @type {import('svelte/attachments').Attachment} */
	function menuClickOutside(node) {
		/** @param {PointerEvent} event */
		function onPointerDown(event) {
			if (!menuOpen) return;
			const target = /** @type {Node | null} */ (event.target);
			if (target && !node.contains(target)) menuOpen = false;
		}
		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key === 'Escape' && menuOpen) {
			menuOpen = false;
			moreBtn?.focus();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<article class="playlist-card" {@attach whileNearViewport((visible) => (nearViewport = visible))}>
	<CoverArt trackId={coverTrackId ?? ''} hasCover={Boolean(coverTrackId)} wash wrapperClass="cover">
		{#snippet placeholder()}
			<IconPlaylist size={36} stroke={1.5} />
		{/snippet}
	</CoverArt>

	<div class="body">
		<div class="head">
			<button
				type="button"
				class="play-btn pressable"
				aria-label={isPlaying ? `Pause ${playlist.title}` : `Play ${playlist.title}`}
				disabled={playlist.tracks.length === 0}
				onclick={togglePlay}
			>
				{#if isPlaying}
					<IconPlayerPauseFilled size={18} aria-hidden="true" />
				{:else}
					<IconPlayerPlayFilled size={18} aria-hidden="true" />
				{/if}
			</button>

			<div class="titles">
				{#if playlist.username}
					<a class="artist" href="{linkBase}/users/{playlist.username}">
						{playlist.uploaderName}
					</a>
				{:else}
					<span class="artist">{playlist.uploaderName}</span>
				{/if}
				{#if titleAsHeading}
					<h1 class="title">{playlist.title}</h1>
				{:else}
					<a class="title" href="/playlists/{playlist.id}">{playlist.title}</a>
				{/if}
				<span class="playlist-meta">
					Playlist · {playlist.trackCount}
					{playlist.trackCount === 1 ? 'track' : 'tracks'}
					{#if playlist.durationMs > 0}
						· {formatDuration(playlist.durationMs)}
					{/if}
				</span>
			</div>

			<div class="aside">
				<span class="uploaded" title={new Date(playlist.createdAt).toLocaleString()}>
					{relativeTime(playlist.createdAt)}
				</span>
				{#if likeCount > 0}
					<span class="tag">{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>
				{/if}
			</div>

			<div class="menu-wrap" {@attach menuClickOutside}>
				<button
					type="button"
					class="more-btn"
					bind:this={moreBtn}
					aria-label="More actions for {playlist.title}"
					aria-expanded={menuOpen}
					aria-haspopup="menu"
					aria-controls="playlist-menu-{playlist.id}"
					onclick={() => (menuOpen = !menuOpen)}
				>
					<span class="more-icon" aria-hidden="true">
						<IconDots size={16} stroke={1.75} />
					</span>
				</button>

				{#if menuOpen}
					<div class="menu" id="playlist-menu-{playlist.id}" role="menu">
						<button type="button" role="menuitem" onclick={copyLink}>
							{copied ? 'Copied!' : 'Copy link'}
						</button>
						{#if playlist.isOwner}
							<a class="menu-item" role="menuitem" href="/playlists/{playlist.id}/edit">Edit</a>
						{/if}
						<button
							type="button"
							role="menuitem"
							disabled={!signedIn || likeBusy}
							onclick={toggleLike}
						>
							{liked ? 'Unlike playlist' : 'Like playlist'}
							{#if likeCount > 0}
								<span class="menu-count">{likeCount}</span>
							{/if}
						</button>
						{#if playlist.isOwner}
							<button
								type="button"
								role="menuitem"
								class="danger"
								disabled={deleteBusy}
								onclick={deletePlaylist}
							>
								Delete playlist
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		{#if activeTrack}
			<div class="wave-row">
				{#if showWaveform}
					<Waveform
						peaks={activeTrack.waveform}
						durationMs={activeTrack.durationMs}
						currentTime={cardTime}
						label="Seek within {activeTrack.title}"
						onseek={handleSeek}
						onscrub={(seconds) => (scrubSeconds = seconds)}
					/>
				{:else}
					<div class="wave-placeholder" aria-hidden="true"></div>
				{/if}
				{#if isActive || scrubSeconds != null}
					<span
						class="time-chip current"
						style:left="min(max({progressPct}%, 1.2rem), calc(100% - 1.2rem))"
					>
						{formatDuration(displayTime * 1000)}
					</span>
				{/if}
				<span class="time-chip total">{formatDuration(activeTrack.durationMs)}</span>

				{#each markers as marker (marker.id)}
					<button
						type="button"
						class="marker"
						class:active={activeMarker?.id === marker.id}
						style:left="{marker.leftPct}%"
						aria-label="{marker.userName} commented at {formatDuration(marker.atMs)}: {marker.body}"
						onclick={() => handleSeek(marker.atMs / 1000)}
						onmouseenter={() => (hoveredMarkerId = marker.id)}
						onmouseleave={() => (hoveredMarkerId = null)}
						onfocus={() => (hoveredMarkerId = marker.id)}
						onblur={() => (hoveredMarkerId = null)}
					>
						<Avatar src={marker.userImage} name={marker.userName} size="1.15rem" />
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

			{#if signedIn && showCommentForm}
				<form class="comment-row" onsubmit={submitComment}>
					<Avatar src={viewerImage} name={viewerName} />
					<div class="comment-field">
						<textarea
							bind:this={commentField}
							name="comment"
							rows="1"
							placeholder={isActive
								? `Comment on ${activeTrack.title} at the current time`
								: `Comment on ${activeTrack.title}`}
							aria-label={isActive
								? `Comment on ${activeTrack.title} at the current time`
								: `Comment on ${activeTrack.title}`}
							maxlength="1000"
							autocomplete="off"
							bind:value={commentBody}
							disabled={commentBusy}
							oninput={resizeCommentField}
							onkeydown={onCommentKeydown}></textarea>
						<button
							type="submit"
							class="send-btn"
							aria-label="Post comment"
							disabled={commentBusy || !commentBody.trim()}
						>
							<IconArrowUp size={12} stroke={1.75} aria-hidden="true" />
						</button>
					</div>
					{#if commentNote}
						<span class="comment-note" role="status">{commentNote}</span>
					{/if}
				</form>
			{/if}
		{/if}

		{#if playlist.tracks.length > 0}
			<ol class="member-list" aria-label="Tracks in {playlist.title}">
				{#each playlist.tracks as track, index (track.id)}
					<li>
						<button
							type="button"
							class="member-row"
							class:active={index === activeIndex && playlistActive}
							onclick={() => playAt(index)}
						>
							<span class="member-index" aria-hidden="true">{index + 1}</span>
							<span class="member-cover" aria-hidden="true">
								<CoverArt
									trackId={track.id}
									hasCover={track.hasCover}
									class="member-cover-art"
									width="36"
									height="36"
								/>
							</span>
							<span class="member-titles">
								<span class="member-title">{track.title}</span>
								<span class="member-artist">{track.artist || track.uploaderName}</span>
							</span>
							<span class="member-duration">{formatDuration(track.durationMs)}</span>
						</button>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="empty-members">No tracks in this playlist yet.</p>
		{/if}
	</div>
</article>

<style>
	.playlist-card {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1rem;
		padding: 1rem;
	}

	.playlist-card :global(> .cover) {
		width: var(--track-card-cover-size, 10rem);
		height: var(--track-card-cover-size, 10rem);
		flex-shrink: 0;
	}

	.playlist-card :global(> .cover img),
	.playlist-card :global(> .cover .cover-placeholder) {
		display: flex;
		width: 100%;
		height: 100%;
		align-items: center;
		justify-content: center;
		border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
		border-radius: 0.125rem;
		box-shadow: 3px 3px 0 var(--cover-shadow);
		object-fit: cover;
		color: var(--muted);
	}

	.playlist-card :global(> .cover img) {
		display: block;
	}

	.playlist-card :global(> .cover .cover-placeholder) {
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			linear-gradient(225deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			var(--paper);
		background-size: 12px 12px;
	}

	.body {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.body > * + * {
		margin-top: 0.75rem;
	}

	.head {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.play-btn {
		display: inline-flex;
		width: 2.75rem;
		height: 2.75rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--ink);
		border-radius: 50%;
		color: var(--on-accent);
		background: var(--accent);
		cursor: pointer;
		flex-shrink: 0;
	}

	.play-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.play-btn :global(svg) {
		display: block;
	}

	.titles {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.artist {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.8rem;
		font-weight: 700;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	a.artist:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.title {
		overflow: hidden;
		margin: 0;
		color: var(--ink);
		font-size: 1.02rem;
		font-weight: 800;
		line-height: 1.25;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	a.title:hover {
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.playlist-meta {
		color: var(--muted);
		font-size: 0.7rem;
		font-weight: 600;
	}

	.aside {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		align-items: flex-end;
		margin-left: auto;
		flex-shrink: 0;
	}

	.uploaded {
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.tag {
		padding: 0.2rem 0.6rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.menu-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.more-btn {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 25%, transparent);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
	}

	.menu {
		position: absolute;
		top: calc(100% + 0.25rem);
		right: 0;
		z-index: 40;
		display: flex;
		min-width: 11rem;
		flex-direction: column;
		padding: 0.25rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		box-shadow: 4px 4px 0 var(--hard-shadow);
	}

	.menu button,
	.menu-item {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.45rem 0.6rem;
		border: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.menu button:hover,
	.menu-item:hover {
		background: color-mix(in srgb, var(--accent) 22%, var(--paper));
	}

	.menu button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.menu .danger {
		color: color-mix(in srgb, var(--ink) 70%, #b00020);
	}

	.menu-count {
		color: var(--muted);
		font-size: 0.7rem;
	}

	.wave-row {
		position: relative;
		min-width: 0;
		max-width: 100%;
	}

	.wave-placeholder {
		height: var(--waveform-height);
	}

	.time-chip {
		position: absolute;
		top: 50%;
		z-index: 2;
		padding: 0.1rem 0.3rem;
		background: var(--inverse);
		color: var(--on-inverse);
		font-size: 0.65rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		pointer-events: none;
		transform: translate(-50%, -50%);
	}

	.time-chip.total {
		right: 0;
		left: auto;
		background: var(--accent);
		color: var(--on-accent);
		transform: translateY(-50%);
	}

	.marker {
		position: absolute;
		top: 50%;
		z-index: 3;
		padding: 0;
		border: 1px solid var(--ink);
		border-radius: 50%;
		background: var(--paper);
		transform: translate(-50%, -50%);
		cursor: pointer;
	}

	.marker.active {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.marker-tip {
		position: absolute;
		bottom: calc(100% + 0.35rem);
		z-index: 4;
		display: flex;
		max-width: 14rem;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.4rem 0.55rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		box-shadow: 3px 3px 0 var(--hard-shadow);
		transform: translateX(-50%);
		pointer-events: none;
	}

	.tip-name {
		font-size: 0.65rem;
		font-weight: 800;
	}

	.tip-body {
		color: var(--muted);
		font-size: 0.72rem;
		line-height: 1.3;
	}

	.comment-row {
		position: relative;
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.comment-field {
		position: relative;
		flex: 1;
		min-width: 0;
	}

	.comment-field textarea {
		display: block;
		width: 100%;
		min-height: 2rem;
		max-height: calc(2rem + 1.125rem * 3);
		padding: 0.3rem 1.85rem 0.3rem 0.55rem;
		border: 1px solid var(--comment-field-border);
		border-radius: 0.125rem;
		background: var(--comment-field-surface);
		box-shadow: var(--comment-field-inner-shadow);
		color: var(--ink);
		font: inherit;
		font-size: 0.82rem;
		line-height: 1.125rem;
		resize: none;
		overflow-y: hidden;
		transition:
			height 160ms ease,
			border-color 120ms ease,
			background-color 120ms ease;
	}

	.comment-field textarea:focus {
		border-color: var(--comment-field-border-focus);
		background: var(--comment-field-surface-focus);
		box-shadow: var(--comment-field-inner-shadow);
		color: var(--comment-field-ink-focus);
		outline: none;
	}

	.comment-field textarea:focus::placeholder {
		color: color-mix(in srgb, var(--comment-field-ink-focus) 55%, transparent);
	}

	@media (prefers-reduced-motion: reduce) {
		.comment-field textarea {
			transition: none;
		}
	}

	.send-btn {
		position: absolute;
		right: 0.28rem;
		bottom: 0.28rem;
		display: inline-flex;
		width: 1.25rem;
		height: 1.25rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		border-radius: 50%;
		color: var(--on-accent);
		background: var(--accent);
		cursor: pointer;
	}

	.send-btn :global(svg) {
		display: block;
	}

	.send-btn:not(:disabled):hover {
		filter: brightness(1.08);
	}

	.send-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.comment-note {
		position: absolute;
		right: 0;
		bottom: calc(100% + 0.25rem);
		padding: 0.15rem 0.4rem;
		background: var(--inverse);
		color: var(--accent);
		font-size: 0.68rem;
		font-weight: 800;
	}

	.member-list {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
	}

	.member-row {
		display: grid;
		grid-template-columns: 1.5rem 2.25rem minmax(0, 1fr) auto;
		gap: 0.65rem;
		align-items: center;
		width: 100%;
		padding: 0.45rem 0.15rem;
		border: 0;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.member-row:hover,
	.member-row.active {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.member-index {
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.member-row.active .member-index {
		color: var(--accent);
	}

	.member-cover {
		display: block;
		width: 2.25rem;
		height: 2.25rem;
		flex-shrink: 0;
	}

	.member-cover :global(.member-cover-art),
	.member-cover :global(.member-cover-art.placeholder) {
		display: block;
		width: 100%;
		height: 100%;
		border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
		border-radius: 0.125rem;
		object-fit: cover;
	}

	.member-cover :global(.member-cover-art.placeholder) {
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			var(--paper);
		background-size: 8px 8px;
	}

	.member-titles {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.1rem;
	}

	.member-title {
		overflow: hidden;
		font-size: 0.85rem;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.member-artist {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.member-duration {
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.empty-members {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	@media (max-width: 640px) {
		.playlist-card {
			grid-template-columns: 1fr;
			position: relative;
			/* Match TrackCard: shell gutter is the mobile inset. */
			padding-inline: 0;
		}

		.playlist-card :global(> .cover) {
			display: none;
		}

		.body {
			position: relative;
			z-index: 1;
		}

		.head {
			justify-content: space-between;
		}

		.titles {
			flex: 1;
			min-width: 0;
		}

		.aside {
			margin-left: 0;
		}
	}

	@media (pointer: coarse) {
		.comment-field textarea {
			padding-right: 2.1rem;
		}

		.send-btn {
			width: 1.45rem;
			height: 1.45rem;
		}
	}
</style>
