<script>
	import IconPhoto from '@tabler/icons-svelte-runes/icons/photo';
	import IconSearch from '@tabler/icons-svelte-runes/icons/search';
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';
	import IconUpload from '@tabler/icons-svelte-runes/icons/upload';
	import IconVideo from '@tabler/icons-svelte-runes/icons/video';
	import IconX from '@tabler/icons-svelte-runes/icons/x';
	import { builder } from '#lib/builder/builder.svelte.js';
	import { siteMediaLibrary } from '#lib/builder/site-media.svelte.js';
	import FloatingHud from '#lib/components/builder/FloatingHud.svelte';

	/** @typedef {import('#lib/builder/site-media.svelte.js').SiteMediaItem} SiteMediaItem */
	/** @typedef {'all' | 'image' | 'video'} MediaFilter */

	let query = $state('');
	/** @type {MediaFilter} */
	let filter = $state('all');
	let selectedId = $state('');
	let nameDraft = $state('');
	const FILTERS = /** @type {const} */ (['all', 'image', 'video']);

	const siteId = $derived(builder.siteId ?? '');
	const picking = $derived(Boolean(builder.mediaPick));

	const visible = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return siteMediaLibrary.items.filter((item) => {
			if (filter !== 'all' && item.kind !== filter) return false;
			if (q && !item.name.toLowerCase().includes(q)) return false;
			return true;
		});
	});

	const selected = $derived(siteMediaLibrary.items.find((item) => item.id === selectedId) ?? null);

	/**
	 * @param {SiteMediaItem} item
	 */
	function selectItem(item) {
		selectedId = item.id;
		nameDraft = item.name;
	}

	/**
	 * @param {SiteMediaItem} item
	 */
	function useItem(item) {
		selectItem(item);
		if (!builder.mediaPick) return;
		builder.assignMedia(item);
	}

	/**
	 * @param {Event} event
	 */
	async function onFiles(event) {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement) || !siteId) return;
		const files = [...(input.files ?? [])];
		input.value = '';
		for (const file of files) {
			const item = await siteMediaLibrary.upload(siteId, file);
			if (!item) break;
			selectItem(item);
		}
	}

	async function saveName() {
		if (!selected || !siteId) return;
		const next = nameDraft.trim();
		if (!next || next === selected.name) {
			nameDraft = selected.name;
			return;
		}
		await siteMediaLibrary.rename(siteId, selected.id, next);
		const fresh = siteMediaLibrary.items.find((item) => item.id === selected.id);
		if (fresh) nameDraft = fresh.name;
	}

	async function removeSelected() {
		if (!selected || !siteId) return;
		if (!confirm(`Delete “${selected.name}”? Blocks using it will show an empty frame.`)) return;
		const id = selected.id;
		const ok = await siteMediaLibrary.remove(siteId, id);
		if (!ok) return;
		if (selectedId === id) {
			selectedId = '';
			nameDraft = '';
		}
	}

	/**
	 * @param {number} bytes
	 */
	function formatBytes(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

{#if builder.mediaOpen}
	<FloatingHud id="media" title="Media" resizable onclose={() => builder.setTool(null)}>
		<div class="library">
			<div class="top">
				<div class="bar">
					<label class="search">
						<IconSearch size={14} stroke={1.75} aria-hidden="true" />
						<input
							type="search"
							placeholder="Search"
							aria-label="Search media"
							bind:value={query}
						/>
						{#if query}
							<button
								type="button"
								class="clear"
								aria-label="Clear search"
								onclick={() => (query = '')}
							>
								<IconX size={12} stroke={1.75} aria-hidden="true" />
							</button>
						{/if}
					</label>
					<label class="upload" class:busy={siteMediaLibrary.uploading}>
						<IconUpload size={14} stroke={1.75} aria-hidden="true" />
						{siteMediaLibrary.uploading ? 'Uploading…' : 'Upload'}
						<input
							class="file"
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm"
							multiple
							disabled={siteMediaLibrary.uploading}
							onchange={onFiles}
						/>
					</label>
				</div>

				<div class="filters" role="tablist" aria-label="Media type">
					{#each FILTERS as key (key)}
						<button
							type="button"
							role="tab"
							class="filter"
							class:active={filter === key}
							aria-selected={filter === key}
							onclick={() => (filter = key)}
						>
							{key === 'all' ? 'All' : key === 'image' ? 'Images' : 'Video'}
						</button>
					{/each}
				</div>

				{#if picking}
					<p class="pick" role="status">Choose a file to place it in the selected block.</p>
				{/if}

				{#if siteMediaLibrary.error}
					<p class="error" role="alert">{siteMediaLibrary.error}</p>
				{/if}
			</div>

			<div class="scroller">
				{#if siteMediaLibrary.loading && siteMediaLibrary.items.length === 0}
					<p class="hint">Loading…</p>
				{:else if visible.length === 0}
					<p class="hint">
						{siteMediaLibrary.items.length === 0
							? 'Upload a jpg, png, webp, gif, mp4, mov, or webm.'
							: 'Nothing matches.'}
					</p>
				{:else}
					<ul class="grid">
						{#each visible as item (item.id)}
							<li>
								<button
									type="button"
									class="tile"
									class:selected={item.id === selectedId}
									aria-pressed={item.id === selectedId}
									title={picking ? `Use ${item.name}` : item.name}
									onclick={() => useItem(item)}
								>
									{#if item.kind === 'video'}
										<video src={item.url} muted playsinline preload="metadata"></video>
										<span class="badge">
											<IconVideo size={14} stroke={1.75} aria-hidden="true" />
										</span>
									{:else}
										<img src={item.url} alt="" />
									{/if}
									<span>{item.name}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			{#if selected}
				<form
					class="dock"
					onsubmit={(event) => {
						event.preventDefault();
						void saveName();
					}}
				>
					<label>
						<span class="sr">Name</span>
						<input
							bind:value={nameDraft}
							maxlength="80"
							aria-label="File name"
							onblur={() => void saveName()}
						/>
					</label>
					<span class="meta">{selected.kind} · {formatBytes(selected.bytes)}</span>
					<button
						type="button"
						class="icon"
						aria-label="Delete {selected.name}"
						onclick={removeSelected}
					>
						<IconTrash size={14} stroke={1.75} aria-hidden="true" />
					</button>
				</form>
			{:else}
				<p class="foot">
					<IconPhoto size={14} stroke={1.75} aria-hidden="true" />
					{siteMediaLibrary.items.length} file{siteMediaLibrary.items.length === 1 ? '' : 's'}
				</p>
			{/if}
		</div>
	</FloatingHud>
{/if}

<style>
	.library {
		display: grid;
		grid-template-rows: auto 1fr auto;
		height: 100%;
		min-height: 0;
	}

	.top {
		display: grid;
	}

	.bar {
		display: flex;
		gap: 0.35rem;
		align-items: center;
		padding: 0.45rem 0.5rem 0;
	}

	.search {
		display: flex;
		flex: 1;
		gap: 0.3rem;
		align-items: center;
		min-width: 0;
		padding: 0.25rem 0.4rem;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--ink));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 6%, var(--paper));
		color: var(--muted);
	}

	.search input {
		width: 100%;
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 0.8rem;
	}

	.search input:focus {
		outline: none;
	}

	.clear,
	.icon {
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}

	.upload,
	.filter {
		padding: 0.3rem 0.45rem;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		background: transparent;
		color: var(--ink);
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.upload {
		display: inline-flex;
		gap: 0.25rem;
		align-items: center;
		flex-shrink: 0;
		cursor: pointer;
	}

	.upload.busy {
		opacity: 0.6;
		cursor: wait;
	}

	.file {
		display: none;
	}

	.filters {
		display: flex;
		gap: 0.3rem;
		padding: 0.4rem 0.5rem 0;
	}

	.filter.active {
		border-color: var(--ink);
		background: var(--accent);
		color: var(--on-accent);
	}

	.pick,
	.error,
	.hint,
	.foot {
		margin: 0;
		padding: 0.4rem 0.55rem 0;
		font-size: 0.75rem;
		color: var(--muted);
	}

	.error {
		color: var(--ink);
	}

	.scroller {
		min-height: 0;
		overflow: auto;
		padding: 0.45rem 0.5rem 0.55rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tile {
		position: relative;
		display: grid;
		grid-template-rows: 4.2rem auto;
		gap: 0.2rem;
		width: 100%;
		padding: 0.2rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		background: color-mix(in srgb, var(--ink) 4%, var(--paper));
		color: var(--ink);
		cursor: pointer;
		text-align: left;
	}

	.tile.selected {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}

	.tile img,
	.tile video {
		width: 100%;
		height: 4.2rem;
		object-fit: cover;
		background: color-mix(in srgb, var(--ink) 12%, black);
	}

	.tile span {
		overflow: hidden;
		font-size: 0.68rem;
		line-height: 1.2;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.tile .badge {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		display: grid;
		color: var(--paper);
		filter: drop-shadow(0 0 2px var(--ink));
	}

	.dock {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 0.35rem;
		align-items: center;
		padding: 0.4rem 0.5rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.dock input {
		width: 100%;
		padding: 0.3rem 0.4rem;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--ink));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 6%, var(--paper));
		color: var(--ink);
		font: inherit;
		font-size: 0.8rem;
	}

	.meta {
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.foot {
		display: flex;
		gap: 0.3rem;
		align-items: center;
		padding-bottom: 0.45rem;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
