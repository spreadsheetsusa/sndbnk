<script>
	import IconFolder from '@tabler/icons-svelte-runes/icons/folder';
	import IconFile from '@tabler/icons-svelte-runes/icons/file';
	import IconPlus from '@tabler/icons-svelte-runes/icons/plus';
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { builder } from '#lib/builder/builder.svelte.js';
	import {
		footerBlockCatalog,
		getBlockDefinition,
		headerBlockCatalog
	} from '#lib/components/blocks/registry.js';
	import FloatingHud from '#lib/components/builder/FloatingHud.svelte';
	import ThemeControls from '#lib/components/ThemeControls.svelte';

	/**
	 * @type {{
	 *   siteId: string,
	 *   form?: {
	 *     pageMessage?: string,
	 *     pageSuccess?: string,
	 *     pageId?: string,
	 *     title?: string,
	 *     slug?: string,
	 *     seoTitle?: string,
	 *     seoDescription?: string
	 *   } | null
	 * }}
	 */
	let { siteId, form = null } = $props();

	let submitting = $state(false);

	const current = $derived(builder.currentPage);
	const isRoot = $derived(current?.path === '/');
	const formForCurrent = $derived(form?.pageId && form.pageId === current?.id ? form : null);
	const selected = $derived(builder.selectedInstance);
	const selectedDef = $derived(selected ? getBlockDefinition(selected.type) : null);
	const headerDef = $derived(builder.header ? getBlockDefinition(builder.header.type) : null);
	const footerDef = $derived(builder.footer ? getBlockDefinition(builder.footer.type) : null);

	/** Depth for folder indent; root = 0. */
	const depthById = $derived.by(() => {
		/** @type {Map<string, number>} */
		const depths = new Map();
		/** @type {Map<string, string | null>} */
		const parents = new Map(builder.pages.map((p) => [p.id, p.parentId]));
		for (const page of builder.pages) {
			let depth = 0;
			let cursor = page.parentId;
			const seen = new Set();
			while (cursor && !seen.has(cursor)) {
				seen.add(cursor);
				depth += 1;
				cursor = parents.get(cursor) ?? null;
			}
			depths.set(page.id, depth);
		}
		return depths;
	});

	const titleValue = $derived(formForCurrent?.title ?? current?.title ?? '');
	const slugValue = $derived(formForCurrent?.slug ?? current?.slug ?? '');
	const seoTitleValue = $derived(formForCurrent?.seoTitle ?? current?.seoTitle ?? '');
	const seoDescriptionValue = $derived(
		formForCurrent?.seoDescription ?? current?.seoDescription ?? ''
	);

	/**
	 * @param {string} pageId
	 */
	function openPage(pageId) {
		builder.selectPage(pageId);
		builder.setInspectorTab('page');
	}

	function handleSubmit() {
		submitting = true;
		return async ({ result, update }) => {
			try {
				await update({ reset: false });
				if (result.type === 'success') {
					await invalidateAll();
				}
			} finally {
				submitting = false;
			}
		};
	}

	/**
	 * @param {string} key
	 * @param {string} value
	 */
	function setProp(key, value) {
		if (!selected) return;
		builder.updateBlockProps(selected.id, { [key]: value });
	}

	/**
	 * @param {import('#lib/components/blocks/registry.js').BlockField} field
	 */
	function blankListItem(field) {
		/** @type {Record<string, string>} */
		const blank = {};
		for (const itemField of field.itemFields ?? []) {
			blank[itemField.key] = '';
		}
		return blank;
	}
</script>

{#snippet chromePicker(kind, catalog, activeType)}
	<ul class="chrome-thumbs" aria-label="{kind} layouts">
		{#each catalog as entry (entry.type)}
			{@const Preview = entry.preview}
			<li>
				<button
					type="button"
					class="thumb"
					class:selected={activeType === entry.type}
					aria-pressed={activeType === entry.type}
					title={entry.label}
					onclick={() => {
						builder.selectChrome(kind);
						if (activeType !== entry.type) builder.setChromeType(kind, entry.type);
					}}
				>
					<span class="frame">
						<Preview />
					</span>
					<span class="label">{entry.label}</span>
				</button>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet chromeFields(kind, instance, def)}
	{#if instance && def}
		<div class="fields">
			{#each def.fields as field (field.key)}
				{#if field.kind === 'list'}
					{@const list = Array.isArray(instance.props[field.key])
						? /** @type {Array<Record<string, unknown>>} */ (instance.props[field.key])
						: []}
					<section class="list-field" aria-label={field.label}>
						<div class="list-head">
							<span>{field.label}</span>
							<button
								type="button"
								class="icon-btn"
								aria-label="Add {field.label} item"
								onclick={() => builder.addChromeListItem(kind, field.key, blankListItem(field))}
							>
								<IconPlus size={14} stroke={1.75} aria-hidden="true" />
							</button>
						</div>
						{#each list as item, itemIndex (`${kind}-${field.key}-${itemIndex}`)}
							<div class="list-item">
								<div class="list-item-head">
									<span>Item {itemIndex + 1}</span>
									<button
										type="button"
										class="icon-btn"
										aria-label="Remove item {itemIndex + 1}"
										onclick={() => builder.removeChromeListItem(kind, field.key, itemIndex)}
									>
										<IconTrash size={14} stroke={1.75} aria-hidden="true" />
									</button>
								</div>
								{#each field.itemFields ?? [] as itemField (itemField.key)}
									<label>
										<span>{itemField.label}</span>
										{#if itemField.kind === 'textarea'}
											<textarea
												rows="3"
												value={String(item[itemField.key] ?? '')}
												oninput={(e) =>
													builder.updateChromeListItem(
														kind,
														field.key,
														itemIndex,
														itemField.key,
														e.currentTarget.value
													)}></textarea>
										{:else}
											<input
												type="text"
												inputmode={itemField.kind === 'url' ? 'url' : 'text'}
												value={String(item[itemField.key] ?? '')}
												oninput={(e) =>
													builder.updateChromeListItem(
														kind,
														field.key,
														itemIndex,
														itemField.key,
														e.currentTarget.value
													)}
											/>
										{/if}
									</label>
								{/each}
							</div>
						{/each}
					</section>
				{:else}
					<label>
						<span>{field.label}</span>
						{#if field.kind === 'textarea'}
							<textarea
								rows="3"
								value={String(instance.props[field.key] ?? '')}
								oninput={(e) =>
									builder.updateChromeProps(kind, {
										[field.key]: e.currentTarget.value
									})}></textarea>
						{:else}
							<input
								type="text"
								inputmode={field.kind === 'url' ? 'url' : 'text'}
								value={String(instance.props[field.key] ?? '')}
								oninput={(e) =>
									builder.updateChromeProps(kind, {
										[field.key]: e.currentTarget.value
									})}
							/>
						{/if}
					</label>
				{/if}
			{/each}
		</div>
	{/if}
{/snippet}

<FloatingHud id="inspector" title="Inspector" resizable collapsible>
	<div class="inspector">
		<div class="tabs" role="tablist" aria-label="Inspector sections">
			<button
				type="button"
				role="tab"
				class="tab"
				class:active={builder.inspectorTab === 'pages'}
				aria-selected={builder.inspectorTab === 'pages'}
				onclick={() => builder.setInspectorTab('pages')}
			>
				Pages
			</button>
			<button
				type="button"
				role="tab"
				class="tab"
				class:active={builder.inspectorTab === 'page'}
				aria-selected={builder.inspectorTab === 'page'}
				onclick={() => builder.setInspectorTab('page')}
			>
				Page
			</button>
			<button
				type="button"
				role="tab"
				class="tab"
				class:active={builder.inspectorTab === 'site'}
				aria-selected={builder.inspectorTab === 'site'}
				onclick={() => builder.setInspectorTab('site')}
			>
				Site
			</button>
			<button
				type="button"
				role="tab"
				class="tab"
				class:active={builder.inspectorTab === 'block'}
				aria-selected={builder.inspectorTab === 'block'}
				onclick={() => builder.setInspectorTab('block')}
			>
				Block
			</button>
		</div>

		{#if builder.inspectorTab === 'pages'}
			<div class="panel" role="tabpanel" aria-label="Pages">
				<ul class="tree" aria-label="Site pages">
					{#each builder.pages as page (page.id)}
						{@const depth = depthById.get(page.id) ?? 0}
						<li style:--depth={depth}>
							<button
								type="button"
								class="tree-row"
								class:active={builder.currentPageId === page.id}
								onclick={() => openPage(page.id)}
							>
								{#if page.path === '/'}
									<IconFolder size={15} stroke={1.75} aria-hidden="true" />
								{:else}
									<IconFile size={15} stroke={1.75} aria-hidden="true" />
								{/if}
								<span class="tree-title">{page.title}</span>
								<span class="tree-path">{page.path}</span>
							</button>
						</li>
					{/each}
				</ul>
				<p class="hint">Root page is ready. Nested pages come next.</p>
			</div>
		{:else if builder.inspectorTab === 'page'}
			<div class="panel" role="tabpanel" aria-label="Page properties">
				{#if !current}
					<p class="hint">Select a page from the Pages tab.</p>
				{:else}
					<form
						method="POST"
						action="?/updatePage"
						aria-label="Page properties"
						aria-busy={submitting}
						use:enhance={handleSubmit}
					>
						<input type="hidden" name="pageId" value={current.id} />
						<input type="hidden" name="siteId" value={siteId} />

						<label>
							<span>Title</span>
							<input
								name="title"
								type="text"
								value={titleValue}
								maxlength="120"
								required
								aria-invalid={Boolean(formForCurrent?.pageMessage)}
							/>
						</label>

						<label>
							<span>Slug</span>
							<input
								name="slug"
								type="text"
								value={isRoot ? '/' : slugValue}
								disabled={isRoot}
								readonly={isRoot}
								maxlength="80"
							/>
						</label>
						{#if isRoot}
							<p class="field-hint">Root path is locked to <code>/</code>.</p>
						{/if}

						<label>
							<span>SEO title</span>
							<input name="seoTitle" type="text" value={seoTitleValue} maxlength="70" />
						</label>

						<label>
							<span>SEO description</span>
							<textarea name="seoDescription" rows="3" maxlength="160"
								>{seoDescriptionValue}</textarea
							>
						</label>

						{#if formForCurrent?.pageMessage && !submitting}
							<p class="form-error" role="alert" aria-live="polite">{formForCurrent.pageMessage}</p>
						{/if}
						{#if formForCurrent?.pageSuccess && !submitting}
							<p class="form-ok" role="status">{formForCurrent.pageSuccess}</p>
						{/if}

						<button type="submit" class="save" disabled={submitting}>
							{submitting ? 'Saving…' : 'Save page'}
						</button>
					</form>
				{/if}
			</div>
		{:else if builder.inspectorTab === 'site'}
			<div class="panel site-panel" role="tabpanel" aria-label="Site chrome">
				<section class="theme-section" aria-labelledby="site-theme-label">
					<header class="theme-head">
						<h2 class="theme-title" id="site-theme-label">Site theme</h2>
					</header>

					<ThemeControls
						accentHex={builder.accentColor}
						appearance={builder.appearance}
						onAccentChange={(hex) => builder.setAccentColor(hex)}
						onAppearanceChange={(value) => builder.setAppearance(value)}
						hint="For your public site and canvas preview — not your SNDBNK account theme."
						idPrefix="site-theme"
					/>

					{#if builder.savingTheme}
						<p class="form-ok" role="status">Saving theme…</p>
					{:else if builder.themeError}
						<p class="form-error" role="alert">{builder.themeError}</p>
					{/if}
				</section>

				<section
					class="chrome-section"
					class:focused={builder.selectedChrome === 'header'}
					aria-labelledby="site-header-label"
				>
					<header class="chrome-head">
						<button
							type="button"
							class="chrome-focus"
							id="site-header-label"
							onclick={() => builder.selectChrome('header')}
						>
							Header
						</button>
						{#if headerDef}
							<p class="chrome-type">{headerDef.label}</p>
						{/if}
					</header>
					{@render chromePicker('header', headerBlockCatalog, builder.header?.type ?? null)}
					{@render chromeFields('header', builder.header, headerDef)}
				</section>

				<section
					class="chrome-section"
					class:focused={builder.selectedChrome === 'footer'}
					aria-labelledby="site-footer-label"
				>
					<header class="chrome-head">
						<button
							type="button"
							class="chrome-focus"
							id="site-footer-label"
							onclick={() => builder.selectChrome('footer')}
						>
							Footer
						</button>
						{#if footerDef}
							<p class="chrome-type">{footerDef.label}</p>
						{/if}
					</header>
					{@render chromePicker('footer', footerBlockCatalog, builder.footer?.type ?? null)}
					{@render chromeFields('footer', builder.footer, footerDef)}
				</section>

				{#if builder.savingChrome}
					<p class="form-ok" role="status">Saving site…</p>
				{:else if builder.chromeError}
					<p class="form-error" role="alert">{builder.chromeError}</p>
				{/if}
				<p class="hint">Header and footer appear on every page preview.</p>
			</div>
		{:else}
			<div class="panel" role="tabpanel" aria-label="Block properties">
				{#if !selected || !selectedDef}
					<p class="hint">Select a block on the canvas to edit its props.</p>
				{:else}
					<header class="block-head">
						<p class="block-cat">{selectedDef.category}</p>
						<h2 class="block-title">{selectedDef.label}</h2>
					</header>

					<div class="fields">
						{#each selectedDef.fields as field (field.key)}
							{#if field.kind === 'list'}
								{@const list = Array.isArray(selected.props[field.key])
									? /** @type {Array<Record<string, unknown>>} */ (selected.props[field.key])
									: []}
								<section class="list-field" aria-label={field.label}>
									<div class="list-head">
										<span>{field.label}</span>
										<button
											type="button"
											class="icon-btn"
											aria-label="Add {field.label} item"
											onclick={() =>
												builder.addBlockListItem(selected.id, field.key, blankListItem(field))}
										>
											<IconPlus size={14} stroke={1.75} aria-hidden="true" />
										</button>
									</div>
									{#each list as item, itemIndex (`${field.key}-${itemIndex}`)}
										<div class="list-item">
											<div class="list-item-head">
												<span>Item {itemIndex + 1}</span>
												<button
													type="button"
													class="icon-btn"
													aria-label="Remove item {itemIndex + 1}"
													onclick={() =>
														builder.removeBlockListItem(selected.id, field.key, itemIndex)}
												>
													<IconTrash size={14} stroke={1.75} aria-hidden="true" />
												</button>
											</div>
											{#each field.itemFields ?? [] as itemField (itemField.key)}
												<label>
													<span>{itemField.label}</span>
													{#if itemField.kind === 'textarea'}
														<textarea
															rows="3"
															value={String(item[itemField.key] ?? '')}
															oninput={(e) =>
																builder.updateBlockListItem(
																	selected.id,
																	field.key,
																	itemIndex,
																	itemField.key,
																	e.currentTarget.value
																)}></textarea>
													{:else}
														<input
															type="text"
															inputmode={itemField.kind === 'url' ? 'url' : 'text'}
															value={String(item[itemField.key] ?? '')}
															oninput={(e) =>
																builder.updateBlockListItem(
																	selected.id,
																	field.key,
																	itemIndex,
																	itemField.key,
																	e.currentTarget.value
																)}
														/>
													{/if}
												</label>
											{/each}
										</div>
									{/each}
								</section>
							{:else}
								<label>
									<span>{field.label}</span>
									{#if field.kind === 'textarea'}
										<textarea
											rows="3"
											value={String(selected.props[field.key] ?? '')}
											oninput={(e) => setProp(field.key, e.currentTarget.value)}></textarea>
									{:else}
										<input
											type="text"
											inputmode={field.kind === 'url' ? 'url' : 'text'}
											value={String(selected.props[field.key] ?? '')}
											oninput={(e) => setProp(field.key, e.currentTarget.value)}
										/>
									{/if}
								</label>
							{/if}
						{/each}
					</div>

					{#if builder.savingBlocks}
						<p class="form-ok" role="status">Saving…</p>
					{:else if builder.blocksError}
						<p class="form-error" role="alert">{builder.blocksError}</p>
					{/if}

					<button type="button" class="danger" onclick={() => builder.removeBlock(selected.id)}>
						Remove block
					</button>
				{/if}
			</div>
		{/if}
	</div>
</FloatingHud>

<style>
	.inspector {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 100%;
		min-height: 0;
	}

	.tabs {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
	}

	.tab {
		padding: 0.45rem 0.25rem;
		border: 0;
		border-right: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		background: transparent;
		color: var(--muted);
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.tab:last-child {
		border-right: 0;
	}

	.tab.active {
		color: var(--ink);
		background: color-mix(in srgb, var(--accent) 14%, var(--paper));
	}

	.panel {
		padding: 0.65rem;
		min-height: 0;
		overflow: auto;
	}

	.site-panel {
		display: grid;
		gap: 1rem;
	}

	.theme-section {
		display: grid;
		gap: 0.65rem;
		padding: 0.55rem;
		border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
	}

	.theme-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.theme-title {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: 0.95rem;
		font-weight: 500;
	}

	.theme-section :global(.theme-controls) {
		margin-inline: -0.15rem;
	}

	.chrome-section {
		display: grid;
		gap: 0.65rem;
		padding: 0.55rem;
		border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
	}

	.chrome-section.focused {
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
		background: color-mix(in srgb, var(--accent) 6%, var(--paper));
	}

	.chrome-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.chrome-focus {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--ink);
		font-family: var(--font-editorial);
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		text-align: left;
	}

	.chrome-type {
		margin: 0;
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.chrome-thumbs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.45rem;
	}

	.thumb {
		display: grid;
		gap: 0.3rem;
		width: 100%;
		padding: 0.3rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
		text-align: left;
	}

	.thumb.selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent);
	}

	.frame {
		display: block;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
		background: color-mix(in srgb, var(--ink) 4%, var(--paper));
	}

	.frame :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.label {
		font-size: 0.65rem;
		line-height: 1.25;
		color: var(--muted);
	}

	.tree {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.2rem;
	}

	.tree-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		padding: 0.4rem 0.45rem;
		padding-left: calc(0.45rem + var(--depth) * 0.85rem);
		border: 1px solid transparent;
		background: transparent;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}

	.tree-row:hover {
		background: color-mix(in srgb, var(--ink) 5%, var(--paper));
	}

	.tree-row.active {
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
		background: color-mix(in srgb, var(--accent) 12%, var(--paper));
	}

	.tree-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.85rem;
	}

	.tree-path {
		font-size: 0.65rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.hint,
	.field-hint {
		margin: 0.65rem 0 0;
		font-size: 0.75rem;
		color: var(--muted);
	}

	form,
	.fields {
		display: grid;
		gap: 0.65rem;
	}

	.block-head {
		margin-bottom: 0.75rem;
	}

	.block-cat {
		margin: 0 0 0.2rem;
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.block-title {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: 1rem;
		font-weight: 500;
	}

	label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.7rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted);
	}

	input,
	textarea {
		width: 100%;
		padding: 0.4rem 0.5rem;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--ink));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 6%, var(--paper));
		color: var(--ink);
		font: inherit;
		font-size: 0.85rem;
		text-transform: none;
		letter-spacing: normal;
	}

	input:disabled,
	input:read-only {
		opacity: 0.7;
		cursor: not-allowed;
	}

	textarea {
		resize: vertical;
		min-height: 4rem;
	}

	.list-field {
		display: grid;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.list-head,
	.list-item-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		font-size: 0.7rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.list-item {
		display: grid;
		gap: 0.45rem;
		padding: 0.45rem;
		background: color-mix(in srgb, var(--ink) 3%, var(--paper));
	}

	.icon-btn {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		background: transparent;
		color: var(--ink);
		cursor: pointer;
	}

	.form-error {
		margin: 0;
		color: var(--ink);
		background: color-mix(in srgb, #c44 18%, var(--paper));
		border: 1px solid var(--ink);
		padding: 0.4rem 0.5rem;
		font-size: 0.8rem;
	}

	.form-ok {
		margin: 0;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.save,
	.danger {
		justify-self: start;
		padding: 0.45rem 0.75rem;
		border: 1px solid var(--ink);
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.save {
		background: var(--accent);
		color: var(--on-accent);
	}

	.danger {
		margin-top: 0.35rem;
		background: transparent;
		color: var(--ink);
	}

	.save:disabled {
		opacity: 0.6;
		cursor: wait;
	}
</style>
