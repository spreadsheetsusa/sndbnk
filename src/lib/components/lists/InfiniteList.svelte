<script>
	import { whenVisible } from '#lib/lists/infinite-scroll.js';

	/**
	 * Paging chrome around a list the parent renders itself, so each surface keeps
	 * its own markup and styles. The parent's rows carry `data-cursor` so the page
	 * can capture a scroll anchor from them.
	 *
	 * @type {{
	 *   list: import('#lib/lists/track-list.svelte.js').TrackList,
	 *   children: import('svelte').Snippet,
	 *   moreLabel?: string,
	 *   endLabel?: string | null
	 * }}
	 */
	let { list, children, moreLabel = 'Load more', endLabel = null } = $props();

	const loadOlder = () => list.autoLoadOlder();
	const loadNewer = () => list.autoLoadNewer();
</script>

{#if !list.atTop}
	<div class="sentinel" aria-hidden="true" {@attach whenVisible(loadNewer)}></div>
	<p class="edge-status">{list.loadingNewer ? 'Loading earlier tracks…' : 'Scroll up for more'}</p>
{/if}

{@render children()}

{#if !list.atEnd}
	<div class="sentinel" aria-hidden="true" {@attach whenVisible(loadOlder)}></div>
{/if}

<div class="paging">
	{#if !list.atEnd}
		<button type="button" class="pressable" disabled={list.loadingOlder} onclick={loadOlder}>
			{list.loadingOlder ? 'Loading…' : moreLabel}
		</button>
	{:else if endLabel}
		<p class="edge-status">{endLabel}</p>
	{/if}

	{#if list.error}
		<p class="paging-error" role="alert">{list.error}</p>
	{/if}

	<p class="sr-only" aria-live="polite">{list.status}</p>
</div>

<style>
	/* Zero-height trip wires; the observer's rootMargin does the anticipation. */
	.sentinel {
		height: 1px;
	}

	.paging {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
		margin-top: 1.75rem;
	}

	.pressable {
		display: inline-flex;
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
		cursor: pointer;
	}

	.pressable:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.edge-status {
		margin: 0 0 0.75rem;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.paging .edge-status {
		margin: 0;
	}

	.paging-error {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
