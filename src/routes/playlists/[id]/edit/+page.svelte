<script>
	import { enhance } from '$app/forms';
	import IconArrowDown from '@tabler/icons-svelte-runes/icons/arrow-down';
	import IconArrowUp from '@tabler/icons-svelte-runes/icons/arrow-up';
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { formatDuration } from '#lib/media/audio-metadata.js';

	let { data, form } = $props();

	let metaBusy = $state(false);
	let tracksBusy = $state(false);

	let title = $state(data.playlist.title);
	let description = $state(data.playlist.description);
	let published = $state(data.playlist.published);

	/** @type {{ id: string, title: string, artist: string | null, uploaderName: string, durationMs: number | null, hasCover: boolean }[]} */
	let tracks = $state([...data.tracks]);

	$effect(() => {
		tracks = [...data.tracks];
	});

	/**
	 * @param {number} index
	 * @param {-1 | 1} delta
	 */
	function move(index, delta) {
		const next = index + delta;
		if (next < 0 || next >= tracks.length) return;
		const copy = [...tracks];
		const [row] = copy.splice(index, 1);
		copy.splice(next, 0, row);
		tracks = copy;
	}
</script>

<svelte:head>
	<title>Edit {data.playlist.title} | SNDBNK</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
	<SiteHeader />

	<main>
		<header class="page-head">
			<p class="eyebrow eyebrow-chip accent-text">@{data.profile.username}</p>
			<h1 class="display-face">Edit playlist</h1>
			<p class="intro">
				<a href="/playlists/{data.playlist.id}">View playlist</a>
				· Add tracks from any track’s menu with “Add to playlist”.
			</p>
		</header>

		<form
			method="POST"
			action="?/update"
			class="playlist-form"
			aria-label="Playlist details"
			aria-busy={metaBusy}
			use:enhance={() => {
				metaBusy = true;
				return async ({ update }) => {
					try {
						await update({ reset: false });
					} finally {
						metaBusy = false;
					}
				};
			}}
		>
			{#if form?.updateMessage && !metaBusy}
				<p class="form-error" role="alert">{form.updateMessage}</p>
			{/if}
			{#if form?.updateSuccess && !metaBusy}
				<p class="form-success" role="status">{form.updateSuccess}</p>
			{/if}

			<label>
				<span>Title</span>
				<input
					name="title"
					type="text"
					required
					maxlength="200"
					bind:value={title}
					disabled={metaBusy}
				/>
			</label>

			<label>
				<span>Description</span>
				<textarea
					name="description"
					rows="4"
					maxlength="5000"
					bind:value={description}
					disabled={metaBusy}></textarea>
			</label>

			<label class="check">
				<input
					type="checkbox"
					name="published"
					value="true"
					bind:checked={published}
					disabled={metaBusy}
				/>
				<span>Publish to profile and feed</span>
			</label>

			<button type="submit" class="pressable" disabled={metaBusy}>
				{metaBusy ? 'Saving…' : 'Save details'}
			</button>
		</form>

		<section class="tracks" aria-labelledby="members-heading">
			<h2 id="members-heading">Tracks ({tracks.length})</h2>

			{#if form?.tracksMessage && !tracksBusy}
				<p class="form-error" role="alert">{form.tracksMessage}</p>
			{/if}
			{#if form?.tracksSuccess && !tracksBusy}
				<p class="form-success" role="status">{form.tracksSuccess}</p>
			{/if}

			{#if tracks.length === 0}
				<p class="empty">No tracks yet. Open any published track and choose “Add to playlist”.</p>
			{:else}
				<form
					method="POST"
					action="?/reorder"
					aria-busy={tracksBusy}
					use:enhance={() => {
						tracksBusy = true;
						return async ({ update }) => {
							try {
								await update({ reset: false });
							} finally {
								tracksBusy = false;
							}
						};
					}}
				>
					<input type="hidden" name="trackIds" value={JSON.stringify(tracks.map((t) => t.id))} />
					<ul class="member-list">
						{#each tracks as track, index (track.id)}
							<li>
								<span class="index">{index + 1}</span>
								<span class="titles">
									<span class="title">{track.title}</span>
									<span class="artist">{track.artist || track.uploaderName}</span>
								</span>
								<span class="duration">{formatDuration(track.durationMs)}</span>
								<div class="row-actions">
									<button
										type="button"
										aria-label="Move up"
										disabled={index === 0 || tracksBusy}
										onclick={() => move(index, -1)}
									>
										<IconArrowUp size={16} stroke={1.75} />
									</button>
									<button
										type="button"
										aria-label="Move down"
										disabled={index === tracks.length - 1 || tracksBusy}
										onclick={() => move(index, 1)}
									>
										<IconArrowDown size={16} stroke={1.75} />
									</button>
								</div>
							</li>
						{/each}
					</ul>
					<button type="submit" class="pressable secondary" disabled={tracksBusy}>
						{tracksBusy ? 'Saving…' : 'Save order'}
					</button>
				</form>

				<ul class="remove-list">
					{#each tracks as track (track.id)}
						<li>
							<form
								method="POST"
								action="?/removeTrack"
								use:enhance={() => {
									tracksBusy = true;
									return async ({ update }) => {
										try {
											await update();
										} finally {
											tracksBusy = false;
										}
									};
								}}
							>
								<input type="hidden" name="trackId" value={track.id} />
								<button type="submit" class="remove-btn" disabled={tracksBusy}>
									<IconTrash size={14} stroke={1.75} />
									Remove {track.title}
								</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</main>
</div>

<style>
	.page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 4rem;
	}

	main {
		width: min(100%, var(--site-content-max));
		margin: 0 auto;
		padding-top: clamp(0.75rem, 2vw, 1.25rem);
	}

	.page-head {
		margin-bottom: 1.5rem;
	}

	.intro {
		margin: 0.5rem 0 0;
		color: var(--muted);
		line-height: 1.5;
	}

	.intro a {
		color: var(--ink);
		font-weight: 700;
	}

	.playlist-form {
		display: flex;
		max-width: 32rem;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 2.5rem;
	}

	.playlist-form label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.playlist-form input[type='text'],
	.playlist-form textarea {
		padding: 0.55rem 0.65rem;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--ink));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 6%, var(--paper));
		color: var(--ink);
		font: inherit;
		font-size: 0.95rem;
		font-weight: 500;
		letter-spacing: 0;
		text-transform: none;
	}

	.check {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		text-transform: none;
		letter-spacing: 0;
		font-weight: 700;
		font-size: 0.9rem;
	}

	.pressable {
		display: inline-flex;
		width: fit-content;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: 0 1.1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.pressable.secondary {
		margin-top: 0.75rem;
		color: var(--ink);
		background: var(--paper);
	}

	.pressable:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.tracks h2 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		font-weight: 800;
	}

	.empty {
		color: var(--muted);
	}

	.member-list,
	.remove-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.member-list li {
		display: grid;
		grid-template-columns: 1.5rem 1fr auto auto;
		gap: 0.65rem;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
	}

	.index {
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 800;
		text-align: right;
	}

	.titles {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.1rem;
	}

	.title {
		overflow: hidden;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.artist,
	.duration {
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.row-actions {
		display: flex;
		gap: 0.25rem;
	}

	.row-actions button {
		display: inline-flex;
		width: 2rem;
		height: 2rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 30%, transparent);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
	}

	.row-actions button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.remove-list {
		margin-top: 1.25rem;
	}

	.remove-btn {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		padding: 0.35rem 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
	}

	.remove-btn:hover {
		color: var(--ink);
	}

	.form-error,
	.form-success {
		margin: 0 0 0.75rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--ink);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.form-error {
		background: color-mix(in srgb, #b00020 12%, var(--paper));
	}

	.form-success {
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
	}
</style>
