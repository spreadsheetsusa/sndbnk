<script>
	import { builder } from '#lib/builder/builder.svelte.js';

	/**
	 * @type {{
	 *   media?: Array<{ trackId: string, filename: string, thumbUrl: string }>
	 * }}
	 */
	let { media = [] } = $props();

	let open = $state(false);

	const selected = $derived(media.find((item) => item.trackId === builder.logoTrackId) ?? null);

	/**
	 * @param {string | null} trackId
	 */
	function pick(trackId) {
		open = false;
		void builder.setLogoTrack(trackId);
	}

	/** @param {MouseEvent} event */
	function onWindowClick(event) {
		const target = /** @type {HTMLElement | null} */ (event.target);
		if (target?.closest('[data-logo-select]')) return;
		open = false;
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class="logo-select" data-logo-select>
	<span class="label" id="site-logo-label">Logo</span>
	<button
		type="button"
		class="trigger"
		aria-labelledby="site-logo-label"
		aria-expanded={open}
		aria-haspopup="listbox"
		onclick={() => (open = !open)}
	>
		{#if selected}
			<img src={selected.thumbUrl} alt="" />
			<span>{selected.filename}</span>
		{:else}
			<span class="empty">No image</span>
		{/if}
	</button>
	{#if open}
		<ul class="menu" role="listbox" aria-labelledby="site-logo-label">
			<li>
				<button
					type="button"
					role="option"
					aria-selected={builder.logoTrackId == null}
					onclick={() => pick(null)}
				>
					<span>No image</span>
				</button>
			</li>
			{#each media as item (item.trackId)}
				<li>
					<button
						type="button"
						role="option"
						aria-selected={item.trackId === builder.logoTrackId}
						onclick={() => pick(item.trackId)}
					>
						<img src={item.thumbUrl} alt="" />
						<span>{item.filename}</span>
					</button>
				</li>
			{/each}
			{#if media.length === 0}
				<li class="none">No covers in the library yet.</li>
			{/if}
		</ul>
	{/if}
</div>

<style>
	.logo-select {
		position: relative;
		display: grid;
		gap: 0.3rem;
	}

	.label {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.trigger,
	.menu button {
		display: flex;
		gap: 0.45rem;
		align-items: center;
		width: 100%;
		min-height: 2rem;
		padding: 0.25rem 0.4rem;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--ink));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 6%, var(--paper));
		color: var(--ink);
		font: inherit;
		font-size: 0.8rem;
		text-align: left;
		cursor: pointer;
	}

	.trigger span,
	.menu button span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty {
		color: var(--muted);
	}

	img {
		width: 1.35rem;
		height: 1.35rem;
		object-fit: cover;
		flex: 0 0 auto;
		border-radius: 0.125rem;
	}

	.menu {
		position: absolute;
		z-index: 5;
		top: calc(100% + 0.2rem);
		left: 0;
		right: 0;
		display: grid;
		gap: 0.2rem;
		max-height: 14rem;
		margin: 0;
		padding: 0.25rem;
		overflow: auto;
		list-style: none;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--ink));
		border-radius: 0.125rem;
		background: var(--paper);
		box-shadow: 0 0.4rem 1rem color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.menu button[aria-selected='true'] {
		color: var(--on-accent);
		background: var(--accent);
	}

	.none {
		padding: 0.35rem 0.4rem;
		color: var(--muted);
		font-size: 0.75rem;
	}
</style>
