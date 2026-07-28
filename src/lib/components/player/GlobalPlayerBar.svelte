<script>
	import { fly } from 'svelte/transition';
	import { page } from '$app/state';
	import { player } from '#lib/player/player.svelte.js';
	import { formatDuration } from '#lib/media/audio-metadata.js';

	const signedIn = $derived(Boolean(page.data.nav?.name));

	let queueOpen = $state(false);
	let likeBusy = $state(false);
	let scrubbing = $state(false);
	let scrubValue = $state(0);

	const progress = $derived(
		player.duration > 0 ? Math.min(player.currentTime / player.duration, 1) : 0
	);
	const sliderValue = $derived(scrubbing ? scrubValue : Math.round(progress * 1000));

	/**
	 * @param {Event & { currentTarget: HTMLInputElement }} event
	 */
	function handleSeekInput(event) {
		scrubValue = Number(event.currentTarget.value);
	}

	/**
	 * @param {Event & { currentTarget: HTMLInputElement }} event
	 */
	function handleSeekCommit(event) {
		const value = Number(event.currentTarget.value);
		player.seek((value / 1000) * player.duration);
		scrubbing = false;
	}

	async function toggleLike() {
		const track = player.current;
		if (!track || likeBusy) return;
		likeBusy = true;
		try {
			const res = await fetch(`/api/tracks/${track.id}/like`, { method: 'POST' });
			if (res.ok) {
				const data = await res.json();
				player.setLiked(track.id, data.liked);
			}
		} finally {
			likeBusy = false;
		}
	}
</script>

{#if player.current}
	{@const track = player.current}
	<div class="player-bar" transition:fly={{ y: 88, duration: 260 }}>
		{#if queueOpen}
			<aside class="queue-panel" aria-label="Next Up">
				<header>
					<span class="eyebrow">Next Up</span>
					{#if player.queue.length > 0}
						<button type="button" class="queue-clear" onclick={() => player.clearQueue()}>
							Clear
						</button>
					{/if}
				</header>
				{#if player.queue.length === 0}
					<p class="queue-empty">Nothing queued. Use “Add to Next Up” on any track.</p>
				{:else}
					<ol>
						{#each player.queue as queued, index (queued.id)}
							<li>
								<button
									type="button"
									class="queue-track"
									onclick={() => {
										player.playFromQueue(index);
									}}
								>
									<span class="queue-title">{queued.title}</span>
									<span class="queue-artist">{queued.artist || queued.uploaderName}</span>
								</button>
								<button
									type="button"
									class="queue-remove"
									aria-label="Remove {queued.title} from queue"
									onclick={() => player.removeFromQueue(index)}
								>
									&times;
								</button>
							</li>
						{/each}
					</ol>
				{/if}
			</aside>
		{/if}

		<div class="bar-inner">
			<div class="transport">
				<button
					type="button"
					class="transport-btn"
					aria-label="Previous"
					onclick={() => player.previous()}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M7 5v14M18 5l-9 7 9 7z" />
					</svg>
				</button>
				<button
					type="button"
					class="transport-btn play"
					aria-label={player.playing ? 'Pause' : 'Play'}
					onclick={() => player.toggle()}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						{#if player.playing}
							<path d="M8 5h3v14H8zM13 5h3v14h-3z" />
						{:else}
							<path d="M8 5l11 7-11 7z" />
						{/if}
					</svg>
				</button>
				<button
					type="button"
					class="transport-btn"
					aria-label="Next"
					disabled={player.queue.length === 0}
					onclick={() => player.next()}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M17 5v14M6 5l9 7-9 7z" />
					</svg>
				</button>
			</div>

			<span class="time elapsed">{formatDuration(player.currentTime * 1000)}</span>

			<input
				class="seek"
				type="range"
				min="0"
				max="1000"
				step="1"
				value={sliderValue}
				aria-label="Seek"
				style:--fill="{(sliderValue / 1000) * 100}%"
				onpointerdown={() => {
					scrubbing = true;
					scrubValue = Math.round(progress * 1000);
				}}
				oninput={handleSeekInput}
				onchange={handleSeekCommit}
			/>

			<span class="time total">{formatDuration(player.duration * 1000)}</span>

			<div class="now-playing">
				{#if track.hasCover}
					<img class="bar-cover" src="/api/media/{track.id}/cover" alt="" width="40" height="40" />
				{:else}
					<span class="bar-cover placeholder" aria-hidden="true"></span>
				{/if}
				<div class="now-meta">
					{#if track.username}
						<a class="now-artist" href="/users/{track.username}">
							{track.artist || track.uploaderName}
						</a>
					{:else}
						<span class="now-artist">{track.artist || track.uploaderName}</span>
					{/if}
					<a class="now-title" href="/tracks/{track.id}">{track.title}</a>
				</div>
			</div>

			<div class="bar-actions">
				{#if signedIn}
					<button
						type="button"
						class="icon-btn"
						class:active={track.likedByViewer}
						aria-label={track.likedByViewer ? 'Unlike' : 'Like'}
						aria-pressed={track.likedByViewer}
						onclick={toggleLike}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M12 21s-7.5-4.8-9.7-9.2C.8 8.7 2.7 5 6.2 5c2 0 3.5 1.1 4.3 2.6l1.5 2.2 1.5-2.2C14.3 6.1 15.8 5 17.8 5c3.5 0 5.4 3.7 3.9 6.8C19.5 16.2 12 21 12 21z"
							/>
						</svg>
					</button>
				{/if}
				<button
					type="button"
					class="icon-btn"
					class:active={queueOpen}
					aria-label="Next Up queue"
					aria-expanded={queueOpen}
					onclick={() => (queueOpen = !queueOpen)}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M4 6h16M4 11h16M4 16h9" fill="none" stroke-width="2" />
						<path d="M16 15l5 3-5 3z" stroke="none" />
					</svg>
					{#if player.queue.length > 0}
						<span class="queue-count">{player.queue.length}</span>
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.player-bar {
		position: fixed;
		z-index: 60;
		right: 0;
		bottom: 0;
		left: 0;
		border-top: 1px solid var(--ink);
		background: var(--paper);
	}

	.bar-inner {
		display: flex;
		gap: clamp(0.6rem, 1.5vw, 1.25rem);
		align-items: center;
		width: min(100%, var(--site-shell-max));
		min-height: 3.75rem;
		margin: 0 auto;
		padding: 0.4rem var(--site-shell-pad-x);
	}

	.transport {
		display: flex;
		gap: 0.35rem;
		align-items: center;
		flex-shrink: 0;
	}

	.transport-btn {
		display: inline-flex;
		width: 2.1rem;
		height: 2.1rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--ink);
		color: var(--ink);
		background: var(--paper);
		cursor: pointer;
	}

	.transport-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.transport-btn svg {
		width: 0.95rem;
		height: 0.95rem;
		fill: currentColor;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linejoin: round;
	}

	.transport-btn.play {
		width: 2.5rem;
		height: 2.5rem;
		color: var(--on-accent);
		background: var(--accent);
	}

	.transport-btn:not(:disabled):hover {
		color: var(--on-accent);
		background: var(--accent);
	}

	.time {
		flex-shrink: 0;
		font-size: 0.72rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.03em;
	}

	.time.elapsed {
		color: var(--accent);
		filter: contrast(1.2);
	}

	.time.total {
		color: var(--muted);
	}

	.seek {
		flex: 1;
		min-width: 4rem;
		height: 1.1rem;
		margin: 0;
		appearance: none;
		background: transparent;
		cursor: pointer;
	}

	.seek::-webkit-slider-runnable-track {
		height: 4px;
		background: linear-gradient(
			to right,
			var(--accent) var(--fill, 0%),
			color-mix(in srgb, var(--ink) 22%, transparent) var(--fill, 0%)
		);
	}

	.seek::-moz-range-track {
		height: 4px;
		background: linear-gradient(
			to right,
			var(--accent) var(--fill, 0%),
			color-mix(in srgb, var(--ink) 22%, transparent) var(--fill, 0%)
		);
	}

	.seek::-webkit-slider-thumb {
		width: 10px;
		height: 10px;
		margin-top: -3px;
		appearance: none;
		border: 1px solid var(--ink);
		border-radius: 50%;
		background: var(--accent);
	}

	.seek::-moz-range-thumb {
		width: 8px;
		height: 8px;
		border: 1px solid var(--ink);
		border-radius: 50%;
		background: var(--accent);
	}

	.now-playing {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		min-width: 0;
		max-width: 16rem;
		flex-shrink: 0;
	}

	.bar-cover {
		display: block;
		width: 2.5rem;
		height: 2.5rem;
		border: 1px solid var(--ink);
		object-fit: cover;
		flex-shrink: 0;
	}

	.bar-cover.placeholder {
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			var(--paper);
		background-size: 8px 8px;
	}

	.now-meta {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.now-artist {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 700;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.now-title {
		overflow: hidden;
		color: var(--ink);
		font-size: 0.8rem;
		font-weight: 800;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.now-artist:hover,
	.now-title:hover {
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.bar-actions {
		display: flex;
		gap: 0.35rem;
		align-items: center;
		flex-shrink: 0;
	}

	.icon-btn {
		position: relative;
		display: inline-flex;
		width: 2.1rem;
		height: 2.1rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--ink);
		color: var(--ink);
		background: var(--paper);
		cursor: pointer;
	}

	.icon-btn svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
	}

	.icon-btn.active {
		color: var(--on-accent);
		background: var(--accent);
	}

	.icon-btn.active svg {
		fill: currentColor;
	}

	.icon-btn:hover {
		color: var(--on-accent);
		background: var(--accent);
	}

	.queue-count {
		position: absolute;
		top: -0.45rem;
		right: -0.45rem;
		min-width: 1rem;
		padding: 0.05rem 0.2rem;
		border: 1px solid var(--ink);
		background: var(--accent);
		color: var(--on-accent);
		font-size: 0.58rem;
		font-weight: 900;
		line-height: 1.2;
		text-align: center;
	}

	.queue-panel {
		position: absolute;
		right: var(--site-shell-pad-x);
		bottom: calc(100% + 0.6rem);
		width: min(22rem, calc(100vw - 2 * var(--site-shell-pad-x)));
		max-height: 50vh;
		padding: 0.85rem;
		overflow: auto;
		border: 1px solid var(--ink);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--ink);
	}

	.queue-panel header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.6rem;
	}

	.queue-clear {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-decoration: underline;
		text-transform: uppercase;
		text-underline-offset: 0.25em;
		cursor: pointer;
	}

	.queue-empty {
		margin: 0;
		color: var(--muted);
		font-size: 0.8rem;
		line-height: 1.5;
	}

	.queue-panel ol {
		display: grid;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.queue-panel li {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}

	.queue-track {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.05rem;
		min-width: 0;
		padding: 0.4rem 0.5rem;
		border: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}

	.queue-track:hover {
		background: color-mix(in srgb, var(--ink) 7%, transparent);
	}

	.queue-title {
		overflow: hidden;
		color: var(--ink);
		font-size: 0.8rem;
		font-weight: 800;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.queue-artist {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.7rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.queue-remove {
		width: 1.6rem;
		height: 1.6rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		color: var(--muted);
		background: transparent;
		font-size: 0.9rem;
		line-height: 1;
		cursor: pointer;
		flex-shrink: 0;
	}

	.queue-remove:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	@media (max-width: 860px) {
		.now-playing {
			display: none;
		}
	}

	@media (max-width: 560px) {
		.time.total {
			display: none;
		}
	}
</style>
