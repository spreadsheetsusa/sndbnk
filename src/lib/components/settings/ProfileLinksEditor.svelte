<script>
	import IconPlus from '@tabler/icons-svelte-runes/icons/plus';
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';

	import ProfileLinkIcon from '#lib/components/ProfileLinkIcon.svelte';
	import {
		CUSTOM_LINK_ID,
		LINK_PRESETS,
		MAX_PROFILE_LINKS,
		isPresetLabel
	} from '#lib/profile-links.js';

	/**
	 * Rows are seeded once; the parent remounts this component with `{#key}`
	 * when the server data changes.
	 * @type {{ initialLinks?: Array<{ label: string, url: string }> }}
	 */
	let { initialLinks = [] } = $props();

	let nextId = 0;

	/**
	 * @param {{ label: string, url: string }} link
	 */
	function toRow(link) {
		const custom = link.label ? !isPresetLabel(link.label) : false;
		return {
			id: nextId++,
			preset: custom ? CUSTOM_LINK_ID : (matchPresetId(link.label) ?? LINK_PRESETS[0].id),
			customLabel: custom ? link.label : '',
			url: link.url
		};
	}

	/**
	 * @param {string} label
	 */
	function matchPresetId(label) {
		const normalized = label.trim().toLowerCase();
		return LINK_PRESETS.find((preset) => preset.label.toLowerCase() === normalized)?.id;
	}

	/**
	 * @param {{ preset: string, customLabel: string }} row
	 */
	function labelFor(row) {
		if (row.preset === CUSTOM_LINK_ID) return row.customLabel;
		return LINK_PRESETS.find((preset) => preset.id === row.preset)?.label ?? '';
	}

	// svelte-ignore state_referenced_locally
	let rows = $state(initialLinks.map(toRow));

	function addRow() {
		rows = [...rows, toRow({ label: '', url: '' })];
	}

	/**
	 * @param {number} id
	 */
	function removeRow(id) {
		rows = rows.filter((row) => row.id !== id);
	}
</script>

<fieldset class="links">
	<legend>Links</legend>
	<p class="links-hint">
		Website, streaming, socials — up to {MAX_PROFILE_LINKS}. They show on your public profile in
		this order.
	</p>

	{#if rows.length === 0}
		<p class="links-empty">No links yet.</p>
	{/if}

	<ul class="link-rows">
		{#each rows as row, index (row.id)}
			<li class="link-row">
				<span class="link-glyph" aria-hidden="true">
					<ProfileLinkIcon label={labelFor(row)} />
				</span>

				<input type="hidden" name="link.{index}.label" value={labelFor(row)} />

				<select bind:value={row.preset} aria-label="Link {index + 1} type">
					{#each LINK_PRESETS as preset (preset.id)}
						<option value={preset.id}>{preset.label}</option>
					{/each}
					<option value={CUSTOM_LINK_ID}>Custom…</option>
				</select>

				{#if row.preset === CUSTOM_LINK_ID}
					<input
						type="text"
						class="custom-label"
						bind:value={row.customLabel}
						placeholder="Label"
						maxlength="40"
						aria-label="Link {index + 1} label"
					/>
				{/if}

				<input
					type="text"
					name="link.{index}.url"
					bind:value={row.url}
					inputmode="url"
					placeholder="https://example.com"
					maxlength="500"
					autocapitalize="none"
					spellcheck="false"
					aria-label="Link {index + 1} URL"
				/>

				<button
					type="button"
					class="row-btn"
					onclick={() => removeRow(row.id)}
					aria-label="Remove link {index + 1}"
					title="Remove link"
				>
					<IconTrash size={16} stroke={1.75} />
				</button>
			</li>
		{/each}
	</ul>

	{#if rows.length < MAX_PROFILE_LINKS}
		<button type="button" class="add-btn" onclick={addRow}>
			<IconPlus size={16} stroke={2} />
			Add link
		</button>
	{/if}
</fieldset>

<style>
	.links {
		margin: 0 0 1.25rem;
		padding: 0;
		border: 0;
	}

	legend {
		padding: 0;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.links-hint {
		margin: 0.5rem 0 0.85rem;
		color: var(--muted);
		font-size: 0.72rem;
		line-height: 1.45;
	}

	.links-empty {
		margin: 0 0 0.75rem;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.link-rows {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.link-row {
		display: grid;
		grid-template-columns: auto 9.5rem 1fr auto;
		gap: 0.5rem;
		align-items: center;
	}

	.link-row:has(.custom-label) {
		grid-template-columns: auto 9.5rem 9.5rem 1fr auto;
	}

	.link-glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid color-mix(in srgb, var(--ink) 25%, transparent);
		color: var(--ink);
	}

	.link-row input,
	.link-row select {
		width: 100%;
		height: 2.75rem;
		min-width: 0;
		margin: 0;
		padding: 0 0.6rem;
		border: 1px solid color-mix(in srgb, var(--ink) 45%, transparent);
		border-radius: 0;
		color: var(--ink);
		background: transparent;
		font-size: 0.85rem;
		outline: none;
	}

	.link-row input:focus,
	.link-row select:focus {
		border-color: var(--ink);
		box-shadow: 3px 3px 0 var(--accent);
	}

	.row-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.4rem;
		height: 2.75rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 45%, transparent);
		color: var(--ink);
		background: transparent;
		cursor: pointer;
	}

	.row-btn:hover {
		border-color: var(--ink);
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}

	.add-btn {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
		width: fit-content;
		margin-top: 0.75rem;
		padding: 0.55rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--ink);
		background: transparent;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.add-btn:hover {
		color: var(--on-accent);
		background: var(--accent);
	}

	@media (max-width: 640px) {
		.link-row,
		.link-row:has(.custom-label) {
			grid-template-columns: auto 1fr auto;
		}

		.link-row input[name$='.url'] {
			grid-column: 1 / -1;
		}
	}
</style>
