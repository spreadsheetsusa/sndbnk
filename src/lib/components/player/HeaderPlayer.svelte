<script>
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconHeartFilled from '@tabler/icons-svelte-runes/icons/heart-filled';
	import IconPlayerPauseFilled from '@tabler/icons-svelte-runes/icons/player-pause-filled';
	import IconPlayerPlayFilled from '@tabler/icons-svelte-runes/icons/player-play-filled';
	import IconPlayerSkipBackFilled from '@tabler/icons-svelte-runes/icons/player-skip-back-filled';
	import IconPlayerSkipForwardFilled from '@tabler/icons-svelte-runes/icons/player-skip-forward-filled';
	import IconPlaylist from '@tabler/icons-svelte-runes/icons/playlist';
	import IconX from '@tabler/icons-svelte-runes/icons/x';
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
	<div class="header-player">
		<div class="strip">
			<div class="transport">
				<button
					type="button"
					class="cell transport-btn"
					aria-label="Previous"
					onclick={() => player.previous()}
				>
					<IconPlayerSkipBackFilled size={15} aria-hidden="true" />
				</button>
				<button
					type="button"
					class="cell transport-btn play"
					aria-label={player.playing ? 'Pause' : 'Play'}
					onclick={() => player.toggle()}
				>
					{#if player.playing}
						<IconPlayerPauseFilled size={17} aria-hidden="true" />
					{:else}
						<IconPlayerPlayFilled size={17} aria-hidden="true" />
					{/if}
				</button>
				<button
					type="button"
					class="cell transport-btn"
					aria-label="Next"
					disabled={player.queue.length === 0}
					onclick={() => player.next()}
				>
					<IconPlayerSkipForwardFilled size={15} aria-hidden="true" />
				</button>
			</div>

			<div class="cell scrub">
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
			</div>

			<div class="cell now-playing">
				{#if track.hasCover}
					<img class="bar-cover" src="/api/media/{track.id}/cover" alt="" width="26" height="26" />
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
						class="cell icon-btn"
						class:active={track.likedByViewer}
						aria-label={track.likedByViewer ? 'Unlike' : 'Like'}
						aria-pressed={track.likedByViewer}
						onclick={toggleLike}
					>
						{#if track.likedByViewer}
							<IconHeartFilled size={15} aria-hidden="true" />
						{:else}
							<IconHeart size={15} stroke={1.75} aria-hidden="true" />
						{/if}
					</button>
				{/if}
				<button
					type="button"
					class="cell icon-btn"
					class:active={queueOpen}
					aria-label="Next Up queue"
					aria-expanded={queueOpen}
					onclick={() => (queueOpen = !queueOpen)}
				>
					<IconPlaylist size={15} stroke={1.75} aria-hidden="true" />
					{#if player.queue.length > 0}
						<span class="queue-count">{player.queue.length}</span>
					{/if}
				</button>
			</div>
		</div>

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
									<IconX size={14} stroke={1.75} aria-hidden="true" />
								</button>
							</li>
						{/each}
					</ol>
				{/if}
			</aside>
		{/if}
	</div>
{/if}

<style>
	.header-player {
		position: relative;
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
		max-width: 100%;
		justify-content: center;
	}

	.strip {
		display: flex;
		align-items: stretch;
		min-width: 0;
		max-width: 100%;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 3px 3px 0 var(--hard-shadow);
	}

	.transport,
	.bar-actions {
		display: flex;
		align-items: stretch;
		flex-shrink: 0;
	}

	.cell {
		display: flex;
		align-items: center;
		min-height: 2.25rem;
		border: 0;
		border-right: 1px solid var(--hard-border);
	}

	.bar-actions .cell:last-child {
		border-right: 0;
	}

	.transport-btn,
	.icon-btn {
		justify-content: center;
		width: 2.1rem;
		padding: 0;
		color: var(--ink);
		background: color-mix(in srgb, var(--paper) 88%, var(--ink));
		cursor: pointer;
		transition:
			background 120ms ease,
			color 120ms ease;
	}

	.transport-btn :global(svg),
	.icon-btn :global(svg) {
		display: block;
	}

	.transport-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.transport-btn.play {
		width: 2.4rem;
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: inset 2px 2px 0 color-mix(in srgb, var(--ink) 35%, transparent);
	}

	.transport-btn:not(:disabled):hover,
	.icon-btn:hover,
	.icon-btn.active {
		color: var(--on-accent);
		background: var(--accent);
	}

	.scrub {
		gap: 0.5rem;
		flex: 1 1 12rem;
		min-width: 7rem;
		padding: 0 0.6rem;
	}

	.time {
		flex-shrink: 0;
		font-size: 0.66rem;
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
		min-width: 3.5rem;
		height: 1rem;
		margin: 0;
		appearance: none;
		background: transparent;
		cursor: pointer;
		touch-action: none;
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
		gap: 0.45rem;
		min-width: 0;
		max-width: 12rem;
		padding: 0 0.6rem;
		flex-shrink: 1;
	}

	.bar-cover {
		display: block;
		width: 1.6rem;
		height: 1.6rem;
		border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
		border-radius: 0.125rem;
		box-shadow: 2px 2px 0 var(--hard-shadow);
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
		min-width: 0;
		line-height: 1.2;
	}

	.now-artist {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.6rem;
		font-weight: 700;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.now-title {
		overflow: hidden;
		color: var(--ink);
		font-size: 0.7rem;
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

	.icon-btn {
		position: relative;
	}

	.queue-count {
		position: absolute;
		top: -0.4rem;
		right: -0.4rem;
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
		z-index: 20;
		top: calc(100% + 0.5rem);
		right: 0;
		width: min(22rem, calc(100vw - 2 * var(--site-shell-pad-x)));
		max-height: 60vh;
		padding: 0.85rem;
		overflow: auto;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
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
		display: inline-flex;
		width: 1.6rem;
		height: 1.6rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		color: var(--muted);
		background: transparent;
		cursor: pointer;
		flex-shrink: 0;
	}

	.queue-remove :global(svg) {
		display: block;
	}

	.queue-remove:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	@media (max-width: 1200px) {
		.now-playing {
			display: none;
		}
	}

	/* Matches the header's wrap breakpoint: full-width row under the logo and nav. */
	@media (max-width: 960px) {
		.header-player {
			order: 2;
			flex-basis: 100%;
			margin-bottom: 0.75rem;
		}

		.strip {
			width: 100%;
		}

		.now-playing {
			display: flex;
			max-width: none;
			flex: 1 1 auto;
		}

		.time.total {
			display: block;
		}
	}

	@media (pointer: coarse) {
		.cell {
			min-height: var(--tap-min);
		}

		.transport-btn,
		.icon-btn {
			width: var(--tap-min);
		}

		.transport-btn.play {
			width: 3.25rem;
		}

		.seek {
			height: 1.75rem;
		}

		.seek::-webkit-slider-runnable-track {
			height: 6px;
		}

		.seek::-moz-range-track {
			height: 6px;
		}

		.seek::-webkit-slider-thumb {
			width: 18px;
			height: 18px;
			margin-top: -6px;
		}

		.seek::-moz-range-thumb {
			width: 18px;
			height: 18px;
		}

		.queue-remove {
			width: var(--tap-min);
			height: var(--tap-min);
		}
	}
</style>
