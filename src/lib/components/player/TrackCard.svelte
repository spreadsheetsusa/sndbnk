<script>
	import Waveform from '#lib/components/player/Waveform.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { formatDuration } from '#lib/media/audio-metadata.js';
	import { relativeTime } from '#lib/relative-time.js';

	/**
	 * @typedef {Object} CardTrack
	 * @property {string} id
	 * @property {string} title
	 * @property {string | null} artist
	 * @property {string | null} genre
	 * @property {number | null} durationMs
	 * @property {boolean} hasCover
	 * @property {number} createdAt
	 * @property {string | null} username
	 * @property {string} uploaderName
	 * @property {number[] | null} waveform
	 * @property {number} likeCount
	 * @property {number} commentCount
	 * @property {boolean} likedByViewer
	 * @property {boolean} isOwner
	 */

	/**
	 * @type {{
	 *   track: CardTrack,
	 *   signedIn?: boolean,
	 *   viewerName?: string | null,
	 *   oncommented?: (comment: { id: string, body: string, atMs: number | null, createdAt: number, userId: string, userName: string }) => void,
	 *   ondeleted?: () => void
	 * }}
	 */
	let { track, signedIn = false, viewerName = null, oncommented, ondeleted } = $props();

	/** @type {{ liked: boolean, count: number } | null} */
	let likeOverride = $state(null);
	const liked = $derived(likeOverride?.liked ?? track.likedByViewer);
	const likeCount = $derived(likeOverride?.count ?? track.likeCount);

	let commentBody = $state('');
	let commentBusy = $state(false);
	/** @type {string | null} */
	let commentNote = $state(null);
	let extraComments = $state(0);
	const commentCount = $derived(track.commentCount + extraComments);

	let menuOpen = $state(false);
	let copied = $state(false);
	let likeBusy = $state(false);
	let deleteBusy = $state(false);
	/** @type {HTMLDivElement | undefined} */
	let menuWrap = $state();

	const isActive = $derived(player.isCurrent(track.id));
	const isPlaying = $derived(isActive && player.playing);
	const cardTime = $derived(isActive ? player.currentTime : 0);
	const durationSec = $derived((track.durationMs ?? 0) / 1000);
	const progressPct = $derived(durationSec > 0 ? Math.min((cardTime / durationSec) * 100, 100) : 0);
	const viewerInitial = $derived((viewerName ?? '?').trim().charAt(0).toUpperCase() || '?');

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
			likedByViewer: liked
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
				extraComments += 1;
				commentNote =
					data.comment.atMs != null
						? `Comment added at ${formatDuration(data.comment.atMs)}`
						: 'Comment added';
				setTimeout(() => (commentNote = null), 2500);
				oncommented?.(data.comment);
			}
		} finally {
			commentBusy = false;
		}
	}

	/** @param {PointerEvent} event */
	function handlePointerDown(event) {
		if (!menuOpen || !menuWrap) return;
		const target = /** @type {Node | null} */ (event.target);
		if (target && !menuWrap.contains(target)) {
			menuOpen = false;
		}
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key === 'Escape' && menuOpen) {
			menuOpen = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />
<svelte:document onpointerdown={handlePointerDown} />

<article class="track-card" class:active={isActive}>
	<div class="cover">
		{#if track.hasCover}
			<img src="/api/media/{track.id}/cover" alt="" loading="lazy" />
		{:else}
			<span class="cover-placeholder" aria-hidden="true"></span>
		{/if}
	</div>

	<div class="body">
		<div class="head">
			<button
				type="button"
				class="play-btn pressable"
				aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
				onclick={togglePlay}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					{#if isPlaying}
						<path d="M8 5h3v14H8zM13 5h3v14h-3z" />
					{:else}
						<path d="M8 5l11 7-11 7z" />
					{/if}
				</svg>
			</button>

			<div class="titles">
				{#if track.username}
					<a class="artist" href="/users/{track.username}">{track.artist || track.uploaderName}</a>
				{:else}
					<span class="artist">{track.artist || track.uploaderName}</span>
				{/if}
				<a class="title" href="/tracks/{track.id}">{track.title}</a>
			</div>

			<div class="aside">
				<span class="uploaded" title={new Date(track.createdAt).toLocaleString()}>
					{relativeTime(track.createdAt)}
				</span>
				{#if track.genre}
					<span class="tag"># {track.genre}</span>
				{/if}
			</div>
		</div>

		<div class="wave-row">
			<Waveform
				peaks={track.waveform}
				durationMs={track.durationMs}
				currentTime={cardTime}
				onseek={handleSeek}
			/>
			{#if isActive}
				<span
					class="time-chip current"
					style:left="min(max({progressPct}%, 1.2rem), calc(100% - 1.2rem))"
				>
					{formatDuration(cardTime * 1000)}
				</span>
			{/if}
			<span class="time-chip total">{formatDuration(track.durationMs)}</span>
		</div>

		{#if signedIn}
			<form class="comment-row" onsubmit={submitComment}>
				<span class="avatar" aria-hidden="true">{viewerInitial}</span>
				<input
					type="text"
					name="comment"
					placeholder={isActive ? 'Write a comment at the current time' : 'Write a comment'}
					maxlength="1000"
					autocomplete="off"
					bind:value={commentBody}
					disabled={commentBusy}
				/>
				<button
					type="submit"
					class="send-btn"
					aria-label="Post comment"
					disabled={commentBusy || !commentBody.trim()}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M3 12l18-8-6 8 6 8z" fill="none" stroke-width="1.6" stroke-linejoin="round" />
					</svg>
				</button>
				{#if commentNote}
					<span class="comment-note" role="status">{commentNote}</span>
				{/if}
			</form>
		{/if}

		<div class="actions">
			<button type="button" class="action-btn" onclick={copyLink}>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path
						d="M9 14l6-6M8 17a4 4 0 01-3-7l2-2M16 7a4 4 0 013 7l-2 2"
						fill="none"
						stroke-width="1.6"
						stroke-linecap="round"
					/>
				</svg>
				{copied ? 'Copied!' : 'Copy link'}
			</button>

			{#if track.isOwner}
				<a class="action-btn" href="/library/{track.id}">
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path
							d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3"
							fill="none"
							stroke-width="1.6"
							stroke-linejoin="round"
						/>
					</svg>
					Edit
				</a>
			{/if}

			<div class="menu-wrap" bind:this={menuWrap}>
				<button
					type="button"
					class="action-btn"
					aria-label="More actions"
					aria-expanded={menuOpen}
					onclick={() => (menuOpen = !menuOpen)}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<circle cx="5" cy="12" r="1.6" />
						<circle cx="12" cy="12" r="1.6" />
						<circle cx="19" cy="12" r="1.6" />
					</svg>
				</button>

				{#if menuOpen}
					<div class="menu" role="menu">
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
						<button type="button" role="menuitem" onclick={addToNextUp}>Add to Next Up</button>
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

			{#if commentCount > 0}
				<span class="counts">
					{commentCount}
					{commentCount === 1 ? 'comment' : 'comments'}
				</span>
			{/if}
		</div>
	</div>
</article>

<style>
	.track-card {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid color-mix(in srgb, var(--ink) 30%, transparent);
		background: color-mix(in srgb, var(--ink) 3%, transparent);
	}

	.track-card.active {
		border-color: var(--ink);
	}

	.cover {
		width: clamp(6.5rem, 16vw, 10.5rem);
		height: clamp(6.5rem, 16vw, 10.5rem);
		flex-shrink: 0;
	}

	.cover img,
	.cover-placeholder {
		display: block;
		width: 100%;
		height: 100%;
		border: 1px solid var(--ink);
		object-fit: cover;
	}

	.cover-placeholder {
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			linear-gradient(225deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			var(--paper);
		background-size: 12px 12px;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.head {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
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

	.play-btn svg {
		width: 1.1rem;
		height: 1.1rem;
		fill: currentColor;
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
		color: var(--ink);
		font-size: 1.02rem;
		font-weight: 800;
		line-height: 1.25;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.title:hover {
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.aside {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		align-items: flex-end;
		justify-content: flex-start;
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

	.wave-row {
		position: relative;
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
	}

	.comment-row {
		position: relative;
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.avatar {
		display: inline-flex;
		width: 2rem;
		height: 2rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--ink);
		border-radius: 50%;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 0.8rem;
		font-weight: 900;
		flex-shrink: 0;
	}

	.comment-row input {
		flex: 1;
		min-width: 0;
		padding: 0.55rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		background: var(--paper);
		color: var(--ink);
		font-size: 0.85rem;
	}

	.comment-row input:focus {
		border-color: var(--ink);
		outline: none;
	}

	.send-btn {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--ink);
		color: var(--ink);
		background: transparent;
		cursor: pointer;
		flex-shrink: 0;
	}

	.send-btn svg {
		width: 1rem;
		height: 1rem;
		stroke: currentColor;
	}

	.send-btn:not(:disabled):hover {
		color: var(--on-accent);
		background: var(--accent);
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

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.action-btn {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
		min-height: 2rem;
		padding: 0 0.65rem;
		border: 1px solid color-mix(in srgb, var(--ink) 40%, transparent);
		background: transparent;
		color: var(--ink);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-decoration: none;
		text-transform: uppercase;
		cursor: pointer;
	}

	.action-btn:hover {
		border-color: var(--ink);
		color: var(--on-accent);
		background: var(--accent);
	}

	.action-btn svg {
		width: 0.95rem;
		height: 0.95rem;
		fill: currentColor;
		stroke: currentColor;
	}

	.menu-wrap {
		position: relative;
	}

	.menu {
		position: absolute;
		z-index: 30;
		top: calc(100% + 0.35rem);
		left: 0;
		display: grid;
		min-width: 11rem;
		padding: 0.3rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--ink);
	}

	.menu button {
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
		text-transform: uppercase;
		cursor: pointer;
	}

	.menu button:not(:disabled):hover {
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

	.counts {
		margin-left: auto;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 600;
	}

	@media (max-width: 640px) {
		.track-card {
			grid-template-columns: 1fr;
		}

		.cover {
			width: 5rem;
			height: 5rem;
		}

		.title,
		.artist {
			white-space: normal;
		}
	}
</style>
