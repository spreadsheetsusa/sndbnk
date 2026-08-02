<script>
	import { onMount } from 'svelte';

	/**
	 * Anchored popover listing the viewer's playlists for adding a track.
	 * Parent keeps the trigger open state; this panel loads on mount.
	 *
	 * @type {{
	 *   trackId: string,
	 *   onclose?: () => void,
	 *   onadded?: (playlist: { id: string, title: string }) => void
	 * }}
	 */
	let { trackId, onclose, onadded } = $props();

	/** @type {{ id: string, title: string, trackCount: number, published: boolean }[]} */
	let playlists = $state([]);
	let loading = $state(true);
	/** @type {string | null} */
	let error = $state(null);
	/** @type {string | null} */
	let note = $state(null);
	/** @type {string | null} */
	let busyId = $state(null);

	onMount(() => {
		let cancelled = false;
		fetch('/api/playlists?mine=1')
			.then(async (res) => {
				if (!res.ok) throw new Error('Could not load playlists.');
				return res.json();
			})
			.then((data) => {
				if (cancelled) return;
				playlists = data.playlists ?? [];
			})
			.catch((err) => {
				if (cancelled) return;
				error = err instanceof Error ? err.message : 'Could not load playlists.';
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	/** @param {{ id: string, title: string }} playlist */
	async function add(playlist) {
		if (busyId) return;
		busyId = playlist.id;
		note = null;
		error = null;
		try {
			const res = await fetch(`/api/playlists/${playlist.id}/tracks`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ trackId })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => null);
				error = data?.message || 'Could not add track.';
				return;
			}
			note = `Added to ${playlist.title}`;
			onadded?.(playlist);
			setTimeout(() => onclose?.(), 700);
		} finally {
			busyId = null;
		}
	}
</script>

<div class="picker" role="menu" aria-label="Add to playlist">
	{#if loading}
		<p class="status">Loading playlists…</p>
	{:else if error}
		<p class="status error" role="alert">{error}</p>
	{:else if playlists.length === 0}
		<p class="status">No playlists yet.</p>
		<a class="menu-item" href="/playlists/new" role="menuitem">New playlist…</a>
	{:else}
		{#if note}
			<p class="status ok" role="status">{note}</p>
		{/if}
		{#each playlists as playlist (playlist.id)}
			<button
				type="button"
				role="menuitem"
				disabled={Boolean(busyId)}
				onclick={() => add(playlist)}
			>
				<span>{playlist.title}</span>
				<span class="count">{playlist.trackCount}</span>
			</button>
		{/each}
		<a class="menu-item" href="/playlists/new" role="menuitem">New playlist…</a>
	{/if}
</div>

<style>
	.picker {
		display: flex;
		min-width: 12rem;
		max-height: 16rem;
		flex-direction: column;
		overflow: auto;
		padding: 0.25rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		box-shadow: 4px 4px 0 var(--hard-shadow);
	}

	.status {
		margin: 0;
		padding: 0.45rem 0.6rem;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.status.error {
		color: color-mix(in srgb, var(--ink) 70%, #b00020);
	}

	.status.ok {
		color: var(--ink);
	}

	.picker button,
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

	.picker button:hover,
	.menu-item:hover {
		background: color-mix(in srgb, var(--accent) 22%, var(--paper));
	}

	.picker button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.count {
		color: var(--muted);
		font-size: 0.7rem;
	}
</style>
