<script>
	import IconDots from '@tabler/icons-svelte-runes/icons/dots';
	import IconHeadphones from '@tabler/icons-svelte-runes/icons/headphones';
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconPlayerPauseFilled from '@tabler/icons-svelte-runes/icons/player-pause-filled';
	import IconPlayerPlayFilled from '@tabler/icons-svelte-runes/icons/player-play-filled';
	import IconRepeat from '@tabler/icons-svelte-runes/icons/repeat';
	import IconArrowUp from '@tabler/icons-svelte-runes/icons/arrow-up';
	import { fade } from 'svelte/transition';

	import Avatar from '#lib/components/Avatar.svelte';
	import CoverArt from '#lib/components/CoverArt.svelte';
	import AddToPlaylistMenu from '#lib/components/player/AddToPlaylistMenu.svelte';
	import Waveform from '#lib/components/player/Waveform.svelte';
	import { parseGenres } from '#lib/genres.js';
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
	 * @typedef {Object} CardTrack
	 * @property {string} id
	 * @property {string} [cursor] position in a paged listing
	 * @property {string} title
	 * @property {string | null} artist
	 * @property {string | null} genre
	 * @property {string} [mediaType]
	 * @property {number | null} durationMs
	 * @property {number | null} [bitrate]
	 * @property {number | null} [sampleRate]
	 * @property {number | null} [channels]
	 * @property {string | null} [codec]
	 * @property {boolean} hasCover
	 * @property {number} createdAt
	 * @property {string | null} username
	 * @property {string} uploaderName
	 * @property {number[] | null} waveform
	 * @property {number} likeCount
	 * @property {number} commentCount
	 * @property {number} [repostCount]
	 * @property {number} [playCount]
	 * @property {boolean} likedByViewer
	 * @property {boolean} [repostedByViewer]
	 * @property {number | null} [repostedAt]
	 * @property {string | null} [repostedByName]
	 * @property {string | null} [repostedByUsername]
	 * @property {boolean} isOwner
	 * @property {TimedComment[] | undefined} [timedComments]
	 */

	/**
	 * @type {{
	 *   track: CardTrack,
	 *   signedIn?: boolean,
	 *   viewerName?: string | null,
	 *   viewerImage?: string | null,
	 *   showCommentForm?: boolean,
	 *   linkBase?: string,
	 *   titleAsHeading?: boolean,
	 *   oncommented?: (comment: { id: string, body: string, atMs: number | null, createdAt: number, userId: string, userName: string, userImage: string | null }) => void,
	 *   ondeleted?: () => void
	 * }}
	 */
	let {
		track,
		signedIn = false,
		viewerName = null,
		viewerImage = null,
		showCommentForm = true,
		linkBase = '',
		titleAsHeading = false,
		oncommented,
		ondeleted
	} = $props();

	/** @type {{ liked: boolean, count: number } | null} */
	let likeOverride = $state(null);
	const liked = $derived(likeOverride?.liked ?? track.likedByViewer);
	const likeCount = $derived(likeOverride?.count ?? track.likeCount);

	/** @type {{ reposted: boolean, count: number } | null} */
	let repostOverride = $state(null);
	const reposted = $derived(repostOverride?.reposted ?? track.repostedByViewer ?? false);
	const repostCount = $derived(repostOverride?.count ?? track.repostCount ?? 0);
	const playCount = $derived(
		player.isCurrent(track.id)
			? (player.current?.playCount ?? track.playCount ?? 0)
			: (track.playCount ?? 0)
	);
	const genres = $derived(parseGenres(track.genre));

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

	/**
	 * Comments posted from this card since load, so markers appear without a reload.
	 * @type {TimedComment[]}
	 */
	let postedComments = $state([]);

	let menuOpen = $state(false);
	/** @type {HTMLButtonElement | null} */
	let moreBtn = $state(null);
	let playlistPickerOpen = $state(false);
	let copied = $state(false);
	let likeBusy = $state(false);
	let repostBusy = $state(false);
	let deleteBusy = $state(false);

	/** Position previewed by an in-flight waveform scrub. @type {number | null} */
	let scrubSeconds = $state(null);

	const isActive = $derived(player.isCurrent(track.id));
	const isPlaying = $derived(isActive && player.playing);
	const cardTime = $derived(isActive ? player.currentTime : 0);

	/**
	 * Each waveform owns a Wavesurfer instance and its canvases, which a long
	 * scrolled list would otherwise accumulate one of per row. Build one only for
	 * cards in reach of the viewport — and always for the playing card, so the
	 * row driving the header player never blinks.
	 */
	let nearViewport = $state(false);
	const showWaveform = $derived(nearViewport || isActive);
	const displayTime = $derived(scrubSeconds ?? cardTime);
	const durationSec = $derived((track.durationMs ?? 0) / 1000);
	const progressPct = $derived(
		durationSec > 0 ? Math.min((displayTime / durationSec) * 100, 100) : 0
	);

	const durationMs = $derived(track.durationMs ?? 0);

	/** Loaded + freshly posted timed comments, positioned along the waveform. */
	const markers = $derived.by(() => {
		if (durationMs <= 0) return [];
		const seen = new Set(postedComments.map((c) => c.id));
		const all = [...(track.timedComments ?? []).filter((c) => !seen.has(c.id)), ...postedComments];
		return all
			.slice()
			.sort((a, b) => a.atMs - b.atMs)
			.map((comment) => ({
				...comment,
				leftPct: Math.min(Math.max((comment.atMs / durationMs) * 100, 0), 100)
			}));
	});

	/**
	 * How close the playhead must be to a marker before its tooltip opens.
	 * Scales with duration so long tracks do not need pixel-perfect timing,
	 * but stays bounded so markers on a long mix do not all stay open.
	 */
	const tooltipWindowMs = $derived(Math.min(Math.max(durationMs * 0.01, 1000), 4000));

	/** The single marker the playhead is currently sitting on, if any. */
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

	// Hovering wins over the playhead so a comment can be read on demand.
	const activeMarker = $derived(
		markers.find((marker) => marker.id === hoveredMarkerId) ?? playheadMarker
	);

	/** @returns {import('#lib/player/player.svelte.js').PlayerTrack} */
	function asPlayerTrack() {
		return {
			id: track.id,
			title: track.title,
			artist: track.artist,
			username: track.username,
			uploaderName: track.uploaderName,
			mediaType: track.mediaType ?? 'track',
			durationMs: track.durationMs,
			bitrate: track.bitrate ?? null,
			sampleRate: track.sampleRate ?? null,
			channels: track.channels ?? null,
			codec: track.codec ?? null,
			hasCover: track.hasCover,
			waveform: track.waveform,
			likedByViewer: liked,
			playCount: track.playCount ?? 0
		};
	}

	function togglePlay() {
		player.toggle(asPlayerTrack());
	}

	/** @param {number} seconds */
	function handleSeek(seconds) {
		if (isActive) {
			player.seek(seconds);
			player.resume();
		} else {
			player.play(asPlayerTrack(), seconds);
		}
	}

	async function copyLink() {
		const url = `${location.origin}/tracks/${track.id}`;
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard unavailable (permissions/insecure context); ignore.
		}
	}

	async function toggleLike() {
		if (!signedIn || likeBusy) return;
		likeBusy = true;
		try {
			const res = await fetch(`/api/tracks/${track.id}/like`, { method: 'POST' });
			if (res.ok) {
				const data = await res.json();
				likeOverride = { liked: data.liked, count: data.likeCount };
				player.setLiked(track.id, data.liked);
			}
		} finally {
			likeBusy = false;
			menuOpen = false;
		}
	}

	async function toggleRepost() {
		if (!signedIn || track.isOwner || repostBusy) return;
		repostBusy = true;
		try {
			const res = await fetch(`/api/tracks/${track.id}/repost`, { method: 'POST' });
			if (res.ok) {
				const data = await res.json();
				repostOverride = { reposted: data.reposted, count: data.repostCount };
			}
		} finally {
			repostBusy = false;
			menuOpen = false;
		}
	}

	function addToNextUp() {
		player.addToQueue(asPlayerTrack());
		menuOpen = false;
	}

	async function deleteTrack() {
		if (deleteBusy) return;
		if (!confirm(`Delete “${track.title}”? This cannot be undone.`)) {
			menuOpen = false;
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
			menuOpen = false;
		}
	}

	/** @param {SubmitEvent} event */
	async function submitComment(event) {
		event.preventDefault();
		const body = commentBody.trim();
		if (!body || commentBusy) return;

		const atMs = isActive && player.currentTime > 0 ? Math.round(player.currentTime * 1000) : null;

		commentBusy = true;
		try {
			const res = await fetch(`/api/tracks/${track.id}/comments`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ body, atMs })
			});
			if (res.ok) {
				const data = await res.json();
				commentBody = '';
				if (data.comment.atMs != null) {
					postedComments = [...postedComments, data.comment];
				}
				commentNote =
					data.comment.atMs != null
						? `Comment added at ${formatDuration(data.comment.atMs)}`
						: 'Comment added';
				setTimeout(() => (commentNote = null), 2500);
				oncommented?.(data.comment);
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
			if (target && !node.contains(target)) {
				menuOpen = false;
			}
		}
		document.addEventListener('pointerdown', onPointerDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
		};
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key === 'Escape' && menuOpen) {
			menuOpen = false;
			playlistPickerOpen = false;
			moreBtn?.focus();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<article class="track-card" {@attach whileNearViewport((visible) => (nearViewport = visible))}>
	<CoverArt trackId={track.id} hasCover={track.hasCover} wash wrapperClass="cover" />

	<div class="body">
		<div class="head">
			<button
				type="button"
				class="play-btn pressable"
				aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
				onclick={togglePlay}
			>
				{#if isPlaying}
					<IconPlayerPauseFilled size={18} aria-hidden="true" />
				{:else}
					<IconPlayerPlayFilled size={18} aria-hidden="true" />
				{/if}
			</button>

			<div class="titles">
				{#if track.username}
					<a class="artist" href="{linkBase}/users/{track.username}">
						{track.artist || track.uploaderName}
					</a>
				{:else}
					<span class="artist">{track.artist || track.uploaderName}</span>
				{/if}
				{#if titleAsHeading}
					<h1 class="title">{track.title}</h1>
				{:else}
					<a class="title" href="/tracks/{track.id}">{track.title}</a>
				{/if}
			</div>

			<div class="aside">
				{#if track.repostedAt}
					<span class="repost-badge" title={new Date(track.repostedAt).toLocaleString()}>
						<IconRepeat size={12} stroke={2} aria-hidden="true" />
						{#if track.repostedByUsername}
							Reposted by @{track.repostedByUsername}
						{:else}
							Reposted
						{/if}
					</span>
				{/if}
				<span class="aside-stats">
					<span class="uploaded" title={new Date(track.createdAt).toLocaleString()}>
						{relativeTime(track.createdAt)}
					</span>
					{#if playCount > 0}
						<span class="stat" title="{playCount} {playCount === 1 ? 'play' : 'plays'}">
							<IconHeadphones size={12} stroke={2} aria-hidden="true" />
							{playCount}
						</span>
					{/if}
					{#if likeCount > 0}
						<span class="stat" title="{likeCount} {likeCount === 1 ? 'like' : 'likes'}">
							<IconHeart size={12} stroke={2} aria-hidden="true" />
							{likeCount}
						</span>
					{/if}
				</span>
				{#if genres.length}
					<span class="tags">
						{#each genres as g (g)}
							<span class="tag"># {g}</span>
						{/each}
					</span>
				{/if}
			</div>

			<div class="menu-wrap" {@attach menuClickOutside}>
				<button
					type="button"
					class="more-btn"
					bind:this={moreBtn}
					aria-label="More actions for {track.title}"
					aria-expanded={menuOpen}
					aria-haspopup="menu"
					aria-controls="track-menu-{track.id}"
					onclick={() => {
						menuOpen = !menuOpen;
						if (!menuOpen) playlistPickerOpen = false;
					}}
				>
					<span class="more-icon" aria-hidden="true">
						<IconDots size={16} stroke={1.75} />
					</span>
					<span class="more-cover" aria-hidden="true">
						<CoverArt trackId={track.id} hasCover={track.hasCover} />
					</span>
				</button>

				{#if menuOpen}
					<div class="menu" id="track-menu-{track.id}" role="menu">
						<button type="button" role="menuitem" onclick={copyLink}>
							{copied ? 'Copied!' : 'Copy link'}
						</button>
						{#if track.isOwner}
							<a class="menu-item" role="menuitem" href="/library?track={track.id}&edit=1">
								Edit
							</a>
						{/if}
						<button
							type="button"
							role="menuitem"
							disabled={!signedIn || likeBusy}
							onclick={toggleLike}
						>
							{liked ? 'Unlike' : 'Like'}
							{#if likeCount > 0}
								<span class="menu-count">{likeCount}</span>
							{/if}
						</button>
						{#if !track.isOwner}
							<button
								type="button"
								role="menuitem"
								disabled={!signedIn || repostBusy}
								onclick={toggleRepost}
							>
								{reposted ? 'Remove repost' : 'Repost'}
								{#if repostCount > 0}
									<span class="menu-count">{repostCount}</span>
								{/if}
							</button>
						{/if}
						<button type="button" role="menuitem" onclick={addToNextUp}>Add to Next Up</button>
						{#if signedIn}
							<button
								type="button"
								role="menuitem"
								onclick={() => (playlistPickerOpen = !playlistPickerOpen)}
							>
								Add to playlist
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
						{/if}
						{#if track.isOwner}
							<button
								type="button"
								role="menuitem"
								class="danger"
								disabled={deleteBusy}
								onclick={deleteTrack}
							>
								Delete Track
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="wave-row">
			{#if showWaveform}
				<Waveform
					peaks={track.waveform}
					durationMs={track.durationMs}
					currentTime={cardTime}
					label="Seek within {track.title}"
					onseek={handleSeek}
					onscrub={(seconds) => (scrubSeconds = seconds)}
				/>
			{:else}
				<!-- Same height as the real waveform, so mounting one shifts nothing. -->
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
			<span class="time-chip total">{formatDuration(track.durationMs)}</span>

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
						placeholder={isActive ? 'Write a comment at the current time' : 'Write a comment'}
						aria-label={isActive ? 'Write a comment at the current time' : 'Write a comment'}
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
	</div>
</article>

<style>
	.track-card {
		--cover-art-wash-scrim: linear-gradient(
			to bottom,
			color-mix(in srgb, var(--paper) 62%, transparent),
			var(--paper)
		);
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1rem;
		padding: 1rem;
	}

	/* Tall enough to outrun the body with the comment row open, so revealing it cannot shift the list.
	   CoverArt owns the .cover node, so pierce with :global. */
	.track-card :global(> .cover) {
		width: var(--track-card-cover-size, 10rem);
		height: var(--track-card-cover-size, 10rem);
		flex-shrink: 0;
	}

	.track-card :global(> .cover img),
	.track-card :global(> .cover .cover-placeholder) {
		display: block;
		width: 100%;
		height: 100%;
		border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
		border-radius: 0.125rem;
		box-shadow: 3px 3px 0 var(--cover-shadow);
		object-fit: cover;
	}

	.track-card :global(> .cover .cover-placeholder) {
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
		order: 0;
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

	.play-btn :global(svg) {
		display: block;
	}

	.titles {
		display: flex;
		order: 1;
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

	.aside {
		display: flex;
		order: 2;
		flex-wrap: wrap;
		gap: 0.3rem 0.55rem;
		align-items: center;
		justify-content: flex-end;
		margin-left: auto;
		flex-shrink: 0;
		max-width: 100%;
	}

	.aside-stats {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		align-items: center;
		justify-content: flex-end;
	}

	.uploaded,
	.stat {
		display: inline-flex;
		gap: 0.25rem;
		align-items: center;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.stat :global(svg) {
		display: block;
	}

	.repost-badge {
		display: inline-flex;
		flex-basis: 100%;
		gap: 0.25rem;
		align-items: center;
		justify-content: flex-end;
		padding: 0.2rem 0.4rem;
		border: 1px solid color-mix(in srgb, var(--ink) 30%, transparent);
		background: color-mix(in srgb, var(--accent) 30%, var(--paper));
		color: var(--ink);
		font-size: 0.6rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		line-height: 1;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.repost-badge :global(svg) {
		display: block;
	}

	.tags {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		justify-content: flex-end;
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

	.wave-row {
		position: relative;
		min-width: 0;
		max-width: 100%;
	}

	/* Matches Waveform's --waveform-height (taller under pointer: coarse). */
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
		font-size: 0.66rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1.3;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.time-chip.current {
		transform: translate(-50%, -50%);
		color: var(--accent);
	}

	.time-chip.total {
		right: 0;
		background: var(--accent);
		color: var(--on-accent);
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
		cursor: pointer;
		--avatar-border: 1px solid var(--paper);
		--avatar-font-size: 0.55rem;
	}

	.marker:hover,
	.marker.active {
		transform: translate(-50%, -50%) scale(1.15);
		--avatar-border: 1px solid var(--ink);
	}

	.marker-tip {
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

	.menu-wrap {
		position: relative;
		order: 3;
		flex-shrink: 0;
	}

	.more-btn {
		display: inline-flex;
		width: 2rem;
		height: 2rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 40%, transparent);
		background: transparent;
		color: var(--ink);
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
			linear-gradient(225deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			var(--paper);
		background-size: 8px 8px;
	}

	.menu {
		position: absolute;
		z-index: 30;
		top: calc(100% + 0.35rem);
		right: 0;
		display: grid;
		min-width: 11rem;
		padding: 0.3rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
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
		gap: 0.5rem;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.55rem 0.65rem;
		border: 0;
		background: transparent;
		color: var(--ink);
		font-size: 0.72rem;
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

	.menu-count {
		color: var(--muted);
		font-weight: 700;
	}

	.menu button:not(:disabled):hover .menu-count {
		color: inherit;
	}

	@media (max-width: 640px) {
		.track-card {
			position: relative;
			isolation: isolate;
			grid-template-columns: 1fr;
		}

		.track-card :global(> .cover) {
			display: var(--track-card-cover-mobile, none);
			width: var(--track-card-cover-size, 100%);
			height: auto;
			aspect-ratio: 1;
			max-width: 100%;
		}

		.menu-wrap {
			order: 1;
		}

		.titles {
			order: 2;
		}

		.aside {
			order: 3;
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
			width: 2.75rem;
			height: 2.75rem;
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

		.title,
		.artist {
			white-space: normal;
		}
	}

	@media (pointer: coarse) {
		.more-btn {
			width: var(--tap-min);
			height: var(--tap-min);
		}

		.comment-field textarea {
			padding-right: 2.1rem;
		}

		.send-btn {
			width: 1.45rem;
			height: 1.45rem;
		}

		.marker :global(.avatar) {
			width: 1.5rem;
			height: 1.5rem;
		}
	}
</style>
