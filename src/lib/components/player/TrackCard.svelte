<script>
	import { tick } from 'svelte';
	import IconChevronDown from '@tabler/icons-svelte-runes/icons/chevron-down';
	import IconDots from '@tabler/icons-svelte-runes/icons/dots';
	import IconDownload from '@tabler/icons-svelte-runes/icons/download';
	import IconHeadphones from '@tabler/icons-svelte-runes/icons/headphones';
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconHeartFilled from '@tabler/icons-svelte-runes/icons/heart-filled';
	import IconMessageCircle from '@tabler/icons-svelte-runes/icons/message-circle';
	import IconRepeat from '@tabler/icons-svelte-runes/icons/repeat';
	import IconArrowUp from '@tabler/icons-svelte-runes/icons/arrow-up';

	import Avatar from '#lib/components/Avatar.svelte';
	import CoverArt from '#lib/components/CoverArt.svelte';
	import AddToPlaylistMenu from '#lib/components/player/AddToPlaylistMenu.svelte';
	import PlayPauseGlyph from '#lib/components/player/PlayPauseGlyph.svelte';
	import Waveform from '#lib/components/player/Waveform.svelte';
	import WaveformCommentMarkers from '#lib/components/player/WaveformCommentMarkers.svelte';
	import { parseGenres } from '#lib/genres.js';
	import { whileNearViewport } from '#lib/lists/infinite-scroll.js';
	import { player } from '#lib/player/player.svelte.js';
	import { toPlayerTrack } from '#lib/player/to-player-track.js';
	import { formatDuration } from '#lib/media/audio-metadata.js';
	import { relativeTime } from '#lib/relative-time.js';
	import { trackPath } from '#lib/track-path.js';

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
	 * @property {string} [slug]
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
	 * @property {string | null} [coverUrl]
	 * @property {string | null} [audioUrl]
	 * @property {number} createdAt
	 * @property {string | null} username
	 * @property {string} uploaderName
	 * @property {number[] | null} waveform
	 * @property {number} likeCount
	 * @property {number} commentCount
	 * @property {number} [repostCount]
	 * @property {number} [playCount]
	 * @property {number} [downloadCount]
	 * @property {boolean} [canDownload]
	 * @property {boolean} [downloadReady]
	 * @property {boolean} likedByViewer
	 * @property {boolean} [repostedByViewer]
	 * @property {number | null} [repostedAt]
	 * @property {string | null} [repostedByName]
	 * @property {string | null} [repostedByUsername]
	 * @property {boolean} isOwner
	 * @property {boolean} [hasPost]
	 * @property {TimedComment[] | undefined} [timedComments]
	 */

	/**
	 * @type {{
	 *   track: CardTrack,
	 *   signedIn?: boolean,
	 *   viewerId?: string | null,
	 *   viewerName?: string | null,
	 *   viewerImage?: string | null,
	 *   showCommentForm?: boolean,
	 *   linkBase?: string,
	 *   titleAsHeading?: boolean,
	 *   hideArtist?: boolean,
	 *   stream?: boolean,
	 *   feedTracks?: import('#lib/player/player.svelte.js').PlayerTrack[] | null,
	 *   feedIndex?: number,
	 *   oncommented?: (comment: { id: string, body: string, atMs: number | null, createdAt: number, userId: string, userName: string, userImage: string | null }) => void,
	 *   onrepositioned?: (comment: TimedComment) => void,
	 *   ondeleted?: () => void
	 * }}
	 */
	let {
		track,
		signedIn = false,
		viewerId = null,
		viewerName = null,
		viewerImage = null,
		showCommentForm = true,
		linkBase = '',
		titleAsHeading = false,
		hideArtist = false,
		stream = false,
		feedTracks = null,
		feedIndex = -1,
		oncommented,
		onrepositioned,
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
	/** @type {{ id: string, count: number } | null} */
	let downloadOverride = $state(null);
	const downloadCount = $derived(
		downloadOverride?.id === track.id ? downloadOverride.count : (track.downloadCount ?? 0)
	);
	const canOfferDownload = $derived(Boolean(track.canDownload && track.downloadReady));

	const playCount = $derived(
		player.isCurrent(track.id)
			? (player.current?.playCount ?? track.playCount ?? 0)
			: (track.playCount ?? 0)
	);
	/** @type {number | null} */
	let commentCountOverride = $state(null);
	const commentCount = $derived(commentCountOverride ?? track.commentCount ?? 0);
	const likeBesidePost = $derived(Boolean(stream && track.hasPost));
	const likeBesideComment = $derived(!likeBesidePost && signedIn && showCommentForm);
	const genres = $derived(parseGenres(track.genre));

	let postOpen = $state(false);
	/** @type {string | null} */
	let postHtml = $state(null);
	let postBusy = $state(false);
	/** @type {string | null} */
	let postError = $state(null);

	const renderPost = $derived.by(() => {
		const html = postHtml ?? '';
		/** @type {import('svelte/attachments').Attachment} */
		return (node) => {
			node.innerHTML = html;
			return () => node.replaceChildren();
		};
	});

	async function togglePost() {
		if (postBusy) return;
		if (postOpen) {
			postOpen = false;
			return;
		}
		postError = null;
		if (postHtml == null) {
			postBusy = true;
			try {
				const res = await fetch(`/api/tracks/${track.id}/post`);
				if (!res.ok) throw new Error('Could not load this post.');
				const body = await res.json();
				postHtml = typeof body.html === 'string' ? body.html : '';
			} catch {
				postError = 'Could not load this post.';
				return;
			} finally {
				postBusy = false;
			}
		}
		if (!postHtml) return;
		await tick();
		postOpen = true;
	}

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

	/** Local atMs overrides after a drag-reposition, keyed by comment id. */
	/** @type {Record<string, number>} */
	let atMsOverrides = $state({});

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
	const isLoading = $derived(isActive && player.loading);
	const playLabel = $derived(
		isLoading
			? `Loading ${track.title}`
			: isPlaying
				? `Pause ${track.title}`
				: `Play ${track.title}`
	);
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
			.map((comment) => {
				const atMs = atMsOverrides[comment.id] ?? comment.atMs;
				return { ...comment, atMs };
			})
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
	const playheadMarkerId = $derived.by(() => {
		if (markers.length === 0 || (!isActive && scrubSeconds == null)) return null;
		const nowMs = displayTime * 1000;
		let closestId = null;
		let closestDelta = Infinity;
		for (const marker of markers) {
			const delta = Math.abs(nowMs - marker.atMs);
			if (delta <= tooltipWindowMs && delta < closestDelta) {
				closestId = marker.id;
				closestDelta = delta;
			}
		}
		return closestId;
	});

	/** @param {TimedComment & { leftPct?: number }} comment */
	function handleCommentRepositioned(comment) {
		atMsOverrides = { ...atMsOverrides, [comment.id]: comment.atMs };
		postedComments = postedComments.map((c) =>
			c.id === comment.id ? { ...c, atMs: comment.atMs } : c
		);
		onrepositioned?.(comment);
	}

	/** @returns {import('#lib/player/player.svelte.js').PlayerTrack} */
	function asPlayerTrack() {
		return toPlayerTrack({ ...track, likedByViewer: liked });
	}

	const hasFeedContinuum = $derived(
		Boolean(feedTracks?.length && feedIndex >= 0 && feedIndex < (feedTracks?.length ?? 0))
	);

	/** @param {number} [atSeconds] */
	function startPlayback(atSeconds) {
		if (hasFeedContinuum && feedTracks) {
			player.playFromFeed(feedTracks, feedIndex, atSeconds);
			return;
		}
		if (atSeconds != null) {
			player.play(asPlayerTrack(), atSeconds);
			return;
		}
		player.toggle(asPlayerTrack());
	}

	function togglePlay() {
		if (isActive) {
			player.toggle();
			return;
		}
		startPlayback();
	}

	/** @param {number} seconds */
	function handleSeek(seconds) {
		if (isActive) {
			player.seek(seconds);
			player.resume();
		} else {
			startPlayback(seconds);
		}
	}

	async function copyLink() {
		const url = `${location.origin}${trackPath(track)}`;
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
				commentCountOverride = commentCount + 1;
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

	/**
	 * Pin the open menu to the trigger and promote it to the top layer so it
	 * paints above sticky chrome, the next card, and floating player windows.
	 * @type {import('svelte/attachments').Attachment}
	 */
	function floatMenu(node) {
		const menu =
			/** @type {HTMLElement & { showPopover?: () => void, hidePopover?: () => void }} */ (node);
		const place = () => {
			const btn = moreBtn;
			if (!btn) return;
			const trigger = btn.getBoundingClientRect();
			const width = menu.offsetWidth;
			const height = menu.offsetHeight;
			const gap = 6;
			const margin = 8;
			const spaceBelow = window.innerHeight - trigger.bottom - margin;
			const spaceAbove = trigger.top - margin;
			const top =
				spaceBelow >= height || spaceBelow >= spaceAbove
					? trigger.bottom + gap
					: Math.max(margin, trigger.top - gap - height);
			const spaceRight = window.innerWidth - trigger.right - margin;
			const spaceLeft = trigger.left - margin;
			const preferredLeft =
				spaceLeft >= spaceRight ? Math.max(margin, trigger.right - width) : trigger.left;
			menu.style.top = `${top}px`;
			menu.style.left = `${Math.min(Math.max(margin, preferredLeft), window.innerWidth - margin - width)}px`;
		};
		menu.style.visibility = 'hidden';
		try {
			menu.showPopover?.();
		} catch {
			// Already showing, or the popover API is unavailable.
		}
		place();
		menu.style.visibility = 'visible';
		const observer = new ResizeObserver(place);
		observer.observe(menu);
		window.addEventListener('scroll', place, true);
		window.addEventListener('resize', place);
		return () => {
			observer.disconnect();
			window.removeEventListener('scroll', place, true);
			window.removeEventListener('resize', place);
			if (menu.matches(':popover-open')) menu.hidePopover?.();
		};
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

{#snippet trackMenu()}
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
		</button>

		{#if menuOpen}
			<div class="menu" id="track-menu-{track.id}" role="menu" popover="manual" {@attach floatMenu}>
				<button type="button" role="menuitem" onclick={copyLink}>
					{copied ? 'Copied!' : 'Copy link'}
				</button>
				{#if canOfferDownload}
					<a
						class="menu-item"
						role="menuitem"
						href="/api/tracks/{track.id}/download"
						download
						onclick={() => {
							downloadOverride = { id: track.id, count: downloadCount + 1 };
							menuOpen = false;
						}}
					>
						Download
						{#if downloadCount > 0}
							<span class="menu-count">{downloadCount}</span>
						{/if}
					</a>
				{/if}
				{#if track.isOwner}
					<a class="menu-item" role="menuitem" href="/library?track={track.id}&edit=1">Edit</a>
				{/if}
				<button type="button" role="menuitem" disabled={!signedIn || likeBusy} onclick={toggleLike}>
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
{/snippet}

{#snippet railStats()}
	<span class="uploaded" title={new Date(track.createdAt).toLocaleString()}>
		{relativeTime(track.createdAt)}
	</span>
	{#if commentCount > 0}
		<span class="stat" title="{commentCount} {commentCount === 1 ? 'comment' : 'comments'}">
			<IconMessageCircle size={12} stroke={2} aria-hidden="true" />
			{commentCount}
		</span>
	{/if}
{/snippet}

{#snippet likeControl()}
	<span class="engage-actions">
		{#if downloadCount > 0}
			<span class="stat" title="{downloadCount} {downloadCount === 1 ? 'download' : 'downloads'}">
				<IconDownload size={12} stroke={2} aria-hidden="true" />
				{downloadCount}
			</span>
		{/if}
		{#if playCount > 0}
			<span class="stat" title="{playCount} {playCount === 1 ? 'listen' : 'listens'}">
				<IconHeadphones size={12} stroke={2} aria-hidden="true" />
				{playCount}
			</span>
		{/if}
		<button
			type="button"
			class="like-btn"
			aria-pressed={liked}
			aria-label="{liked ? 'Unlike' : 'Like'}, {likeCount} {likeCount === 1 ? 'like' : 'likes'}"
			title="{likeCount} {likeCount === 1 ? 'like' : 'likes'}"
			disabled={!signedIn || likeBusy}
			onclick={toggleLike}
		>
			{#if liked}
				<IconHeartFilled size={14} aria-hidden="true" />
			{:else}
				<IconHeart size={14} stroke={2} aria-hidden="true" />
			{/if}
			<span>{likeCount}</span>
		</button>
	</span>
{/snippet}

<div class="track-frame">
	<article
		class="track-card"
		class:stream
		{@attach whileNearViewport((visible) => (nearViewport = visible))}
	>
		<CoverArt
			trackId={track.id}
			hasCover={track.hasCover}
			coverUrl={track.coverUrl}
			wash
			wrapperClass="cover"
		/>
		<button
			type="button"
			class="cover-play"
			aria-label={playLabel}
			aria-busy={isLoading}
			onclick={togglePlay}
		>
			<span class="cover-play-mark">
				<PlayPauseGlyph playing={isPlaying} loading={isLoading} size={15} />
			</span>
		</button>

		<div class="body">
			<div class="head">
				<div class="titles">
					<div class="compact-rail">
						{@render railStats()}
						{@render trackMenu()}
					</div>
					{#if !hideArtist}
						{#if track.username}
							<a class="artist" href="{linkBase}/users/{track.username}">
								{track.artist || track.uploaderName}
							</a>
						{:else}
							<span class="artist">{track.artist || track.uploaderName}</span>
						{/if}
					{/if}
					{#if titleAsHeading}
						<h1 class="title">{track.title}</h1>
					{:else}
						<a class="title" href={trackPath(track)}>{track.title}</a>
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
						{@render railStats()}
					</span>
					{#if genres.length}
						<span class="tags">
							{#each genres as g (g)}
								<span class="tag"># {g}</span>
							{/each}
						</span>
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

				<WaveformCommentMarkers
					trackId={track.id}
					{markers}
					{viewerId}
					{durationMs}
					{playheadMarkerId}
					onseek={handleSeek}
					onscrub={(seconds) => (scrubSeconds = seconds)}
					onrepositioned={handleCommentRepositioned}
				/>
			</div>

			{#if stream && track.hasPost}
				<div class="post">
					<div class="post-bar">
						{@render likeControl()}
						<button
							type="button"
							class="post-toggle"
							aria-expanded={postOpen}
							aria-controls="track-post-{track.id}"
							onclick={(event) => {
								event.stopPropagation();
								togglePost();
							}}
						>
							{postBusy ? 'Loading…' : postOpen ? 'Less info' : 'More info'}
							<span class="chevron" aria-hidden="true">
								<IconChevronDown size={14} stroke={1.75} />
							</span>
						</button>
					</div>
					{#if postError}
						<p class="post-error" role="alert">{postError}</p>
					{/if}
					<div
						class="post-panel"
						class:open={postOpen}
						id="track-post-{track.id}"
						inert={!postOpen}
					>
						<div class="post-clip">
							<div class="post-body" {@attach renderPost}></div>
						</div>
					</div>
				</div>
			{/if}

			{#if signedIn && showCommentForm}
				<div class="engage-row">
					{#if likeBesideComment}
						{@render likeControl()}
					{/if}
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
				</div>
			{:else if !likeBesidePost}
				<div class="engage-row">
					{@render likeControl()}
				</div>
			{/if}
		</div>
	</article>
</div>

<style>
	.track-frame {
		container-type: inline-size;
		container-name: player;
	}

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
		grid-column: 1;
		grid-row: 1;
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

	.cover-play {
		position: relative;
		z-index: 1;
		display: grid;
		grid-column: 1;
		grid-row: 1;
		box-sizing: border-box;
		width: var(--track-card-cover-size, 10rem);
		height: var(--track-card-cover-size, 10rem);
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: 0.125rem;
		background: transparent;
		color: var(--ink);
		cursor: pointer;
	}

	.cover-play::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: transparent;
		transition: background 120ms ease;
	}

	.cover-play:hover::before,
	.cover-play:focus-visible::before {
		background: color-mix(in srgb, var(--ink) 22%, transparent);
	}

	.cover-play-mark {
		position: relative;
		z-index: 1;
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		place-items: center;
		border-radius: 50%;
		background: color-mix(in srgb, var(--paper) 88%, transparent);
	}

	.cover-play-mark :global(svg) {
		display: block;
		width: 1.15rem;
		height: 1.15rem;
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
		padding: 0.15rem 0.4rem;
		border: 1px solid var(--accent);
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--ink) 10%, var(--paper));
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		line-height: 1.2;
		white-space: nowrap;
		transition:
			background 120ms ease,
			color 120ms ease;
	}

	.tag:hover {
		background: var(--accent);
		color: var(--on-accent);
	}

	.wave-row {
		position: relative;
		min-width: 0;
		max-width: 100%;
	}

	.post-bar,
	.engage-row {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		min-width: 0;
	}

	.engage-row .comment-row {
		flex: 1;
		min-width: 0;
	}

	.engage-actions {
		display: inline-flex;
		flex-shrink: 0;
		gap: 0.55rem;
		align-items: center;
	}

	.like-btn {
		display: inline-flex;
		flex-shrink: 0;
		gap: 0.28rem;
		align-items: center;
		padding: 0.2rem 0.15rem;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		white-space: nowrap;
		cursor: pointer;
	}

	.like-btn :global(svg) {
		display: block;
	}

	.like-btn:not(:disabled):hover {
		color: var(--ink);
	}

	.like-btn[aria-pressed='true'],
	.like-btn[aria-pressed='true']:hover {
		color: var(--accent);
	}

	.like-btn:disabled {
		cursor: default;
	}

	.post-toggle {
		display: inline-flex;
		gap: 0.3rem;
		align-items: center;
		padding: 0.3rem 0.55rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		line-height: 1;
		text-transform: uppercase;
		cursor: pointer;
	}

	.post-toggle:hover {
		border-color: var(--ink);
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
	}

	.chevron {
		display: inline-flex;
		transition: transform 220ms ease;
	}

	.post-toggle[aria-expanded='true'] .chevron {
		transform: rotate(180deg);
	}

	.post-error {
		margin: 0.4rem 0 0;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.post-panel {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 280ms ease;
	}

	.post-panel.open {
		grid-template-rows: 1fr;
	}

	.post-clip {
		overflow: hidden;
	}

	.post-body {
		padding-top: 0.75rem;
		color: var(--muted);
		font-size: 0.92rem;
		line-height: 1.55;
		overflow-wrap: anywhere;
	}

	.post-body :global(p) {
		margin: 0;
	}

	.post-body :global(img) {
		display: block;
		max-width: min(100%, 32rem);
		height: auto;
		margin: 0 0 0.75rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron,
		.post-panel {
			transition: none;
		}
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

	/* The menu sits in the title block so a narrow card can float it with the
	   timestamp. On a wide card, pin that cluster to the head edge. */
	.track-card .head {
		position: relative;
	}

	.track-card .compact-rail {
		position: absolute;
		top: 50%;
		right: 0;
		z-index: 2;
		display: flex;
		gap: 0.35rem;
		align-items: center;
		transform: translateY(-50%);
	}

	.track-card .compact-rail .uploaded,
	.track-card .compact-rail .stat {
		display: none;
	}

	.track-card .aside {
		margin-right: 2.75rem;
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

	.menu {
		position: fixed;
		/* Top layer via popover; this still wins if a browser paints it in-flow. */
		z-index: 1200;
		inset: unset;
		display: grid;
		width: max-content;
		min-width: 11rem;
		max-width: calc(100vw - 1rem);
		height: auto;
		margin: 0;
		padding: 0.3rem;
		overflow: visible;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		color: var(--ink);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	@supports selector(:popover-open) {
		.menu:not(:popover-open) {
			display: none;
		}

		.menu:popover-open {
			display: grid;
		}
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

	.menu button:not(:disabled):hover .menu-count,
	.menu .menu-item:hover .menu-count {
		color: inherit;
	}

	@media (max-width: 640px) {
		.track-card {
			position: relative;
			isolation: isolate;
			/* Shell gutter is the mobile inset; don't pad the card again. */
			padding-inline: 0;
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
	}

	/* Narrow card: phone, a slim feed column, or a builder block under ~640px. */
	@container player (max-width: 40rem) {
		.track-card {
			--compact-cover: calc(3.5rem + 20px);
			grid-template-columns: var(--compact-cover) minmax(0, 1fr);
			column-gap: 0.65rem;
			row-gap: 0;
			align-items: start;
		}

		/* Head and waveform become grid cells so the cover sits beside the
		   title and genres only, and the waveform stays full width. */
		.track-card .body {
			display: contents;
		}

		.track-card .body > * + * {
			margin-top: 0;
		}

		.track-card :global(> .cover),
		.track-card > .cover-play {
			grid-column: 1;
			grid-row: 1;
			align-self: start;
			justify-self: start;
		}

		.track-card > .cover-play {
			width: var(--compact-cover);
			height: var(--compact-cover);
			border-radius: 0.25rem;
		}

		.track-card .cover-play-mark {
			width: 2.15rem;
			height: 2.15rem;
		}

		.track-card .cover-play-mark :global(svg) {
			width: 18px;
			height: 18px;
		}

		.track-card :global(> .cover) {
			display: block;
			box-sizing: border-box;
			width: var(--compact-cover);
			height: var(--compact-cover);
			max-width: none;
			aspect-ratio: auto;
			overflow: hidden;
			border: 1px solid color-mix(in srgb, var(--ink) 80%, transparent);
			border-radius: 0.25rem;
			box-shadow: 3px 3px 0 color-mix(in srgb, var(--ink) 80%, transparent);
		}

		.track-card :global(> .cover img),
		.track-card :global(> .cover .cover-placeholder) {
			border: 0;
			border-radius: 0;
			box-shadow: none;
		}

		.track-card .head {
			display: block;
			grid-column: 2;
			grid-row: 1;
			min-width: 0;
		}

		.track-card .titles {
			display: block;
			flex: none;
			order: 0;
			min-width: 0;
			overflow: visible;
		}

		.track-card .compact-rail {
			position: static;
			z-index: auto;
			float: right;
			transform: none;
			margin: 0 0 0.1rem 0.45rem;
		}

		.track-card .compact-rail .uploaded,
		.track-card .compact-rail .stat {
			display: inline-flex;
		}

		.track-card .artist {
			display: block;
			overflow: visible;
			white-space: normal;
			text-overflow: unset;
			overflow-wrap: break-word;
		}

		.track-card .title {
			display: inline;
			overflow: visible;
			white-space: normal;
			text-overflow: unset;
			overflow-wrap: break-word;
		}

		.track-card .aside {
			display: flex;
			flex: none;
			flex-direction: column;
			flex-wrap: nowrap;
			align-items: flex-start;
			justify-content: flex-start;
			order: 0;
			width: 100%;
			max-width: 100%;
			margin: 0.4rem 0 0;
		}

		.track-card .aside:not(:has(.tags, .repost-badge)) {
			display: none;
		}

		.track-card .aside-stats {
			display: none;
		}

		.track-card .repost-badge {
			flex-basis: auto;
			justify-content: flex-start;
		}

		.track-card .tags {
			flex: none;
			justify-content: flex-start;
		}

		.track-card .more-icon {
			display: inline-flex;
		}

		.track-card .more-btn {
			display: inline-flex;
			width: 1.75rem;
			height: 1.75rem;
			padding: 0;
			overflow: visible;
			border: 1px solid color-mix(in srgb, var(--ink) 40%, transparent);
			border-radius: 0;
			background: transparent;
			color: var(--ink);
		}

		.track-card .more-btn:hover,
		.track-card .more-btn[aria-expanded='true'] {
			border-color: var(--ink);
			outline: none;
			color: var(--on-accent);
			background: var(--accent);
		}

		.track-card .more-btn:hover::after,
		.track-card .more-btn[aria-expanded='true']::after {
			content: none;
		}

		.track-card .wave-row,
		.track-card .post,
		.track-card .engage-row {
			grid-column: 1 / -1;
			margin-top: 0.75rem;
		}
	}
</style>
