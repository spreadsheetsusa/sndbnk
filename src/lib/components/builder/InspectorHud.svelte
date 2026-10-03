<script>
	import IconChevronDown from '@tabler/icons-svelte-runes/icons/chevron-down';
	import IconFolder from '@tabler/icons-svelte-runes/icons/folder';
	import IconFile from '@tabler/icons-svelte-runes/icons/file';
	import IconPlus from '@tabler/icons-svelte-runes/icons/plus';
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { builder } from '#lib/builder/builder.svelte.js';
	import { THEME_PERSONA_OPTIONS } from '#lib/builder/theme-persona.js';
	import {
		footerBlockCatalog,
		getBlockDefinition,
		headerBlockCatalog
	} from '#lib/components/blocks/registry.js';
	import BlockLayers from '#lib/components/builder/BlockLayers.svelte';
	import ChromeAccentControl from '#lib/components/builder/ChromeAccentControl.svelte';
	import FloatingHud from '#lib/components/builder/FloatingHud.svelte';
	import LogoMediaSelect from '#lib/components/builder/LogoMediaSelect.svelte';
	import SiteBackgroundControls from '#lib/components/builder/SiteBackgroundControls.svelte';
	import StreamInspector from '#lib/components/builder/StreamInspector.svelte';
	import PersonaPaletteEditor from '#lib/components/builder/PersonaPaletteEditor.svelte';
	import ThemeControls from '#lib/components/ThemeControls.svelte';
	import { isSafeHref } from '#lib/safe-href.js';
	import { siteMediaUrl } from '#lib/site-media-url.js';
	import { ACCENTS, normalizeHex } from '#lib/stores/brand.js';

	/**
	 * @type {{
	 *   siteId: string,
	 *   logoMedia?: Array<{ id: string, filename: string, thumbUrl: string }>,
	 *   form?: {
	 *     pagesMessage?: string,
	 *     pagesSuccess?: string,
	 *     createdPageId?: string,
	 *     deletedPageId?: string,
	 *     pageMessage?: string,
	 *     pageSuccess?: string,
	 *     pageId?: string,
	 *     title?: string,
	 *     slug?: string,
	 *     seoTitle?: string,
	 *     seoDescription?: string
	 *   } | null,
	 *   catalogItems?: Array<Record<string, any>>
	 * }}
	 */
	let { siteId, form = null, logoMedia = [], catalogItems = [] } = $props();

	const logoFallback = $derived(
		builder.logoTrackId &&
			builder.logoUrl &&
			!logoMedia.some((item) => item.id === builder.logoTrackId)
			? { id: builder.logoTrackId, filename: 'Saved image', thumbUrl: builder.logoUrl }
			: null
	);
	const backgroundFallback = $derived(
		builder.backgroundTrackId &&
			builder.backgroundUrl &&
			!logoMedia.some((item) => item.id === builder.backgroundTrackId)
			? {
					id: builder.backgroundTrackId,
					filename: 'Saved image',
					thumbUrl: builder.backgroundUrl
				}
			: null
	);

	let submitting = $state(false);
	let headerLayoutsOpen = $state(false);

	const headerShowCta = $derived(builder.header?.props.showCta !== false);
	const headerHideOnScroll = $derived(builder.header?.props.hideOnScroll === true);

	/**
	 * @param {string} key
	 * @param {boolean} value
	 */
	function setHeaderFlag(key, value) {
		builder.selectChrome('header');
		builder.updateChromeProps('header', { [key]: value });
	}

	const current = $derived(builder.currentPage);
	const isRoot = $derived(current?.path === '/');
	const pagesForm = $derived(form?.pagesMessage || form?.pagesSuccess ? form : null);
	const formForCurrent = $derived(form?.pageId && form.pageId === current?.id ? form : null);
	const selected = $derived(builder.selectedInstance);
	const selectedDef = $derived(selected ? getBlockDefinition(selected.type) : null);
	const headerDef = $derived(builder.header ? getBlockDefinition(builder.header.type) : null);
	const footerDef = $derived(builder.footer ? getBlockDefinition(builder.footer.type) : null);
	const siteAccent = $derived(normalizeHex(builder.accentColor) ?? ACCENTS[0].value);

	/** Depth for folder indent; root = 0. */
	const depthById = $derived.by(() => {
		/** @type {Map<string, number>} */
		const depths = new SvelteMap();
		/** @type {Map<string, string | null>} */
		const parents = new SvelteMap(builder.pages.map((p) => [p.id, p.parentId]));
		for (const page of builder.pages) {
			let depth = 0;
			let cursor = page.parentId;
			const seen = new SvelteSet();
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

	function handlePagesSubmit() {
		submitting = true;
		return async ({ result, update }) => {
			try {
				await update({ reset: result.type === 'success' });
				if (result.type !== 'success') return;
				await tick();
				const createdPageId = result.data?.createdPageId;
				if (
					typeof createdPageId === 'string' &&
					builder.pages.some((page) => page.id === createdPageId)
				) {
					builder.selectPage(createdPageId);
				}
			} finally {
				submitting = false;
			}
		};
	}

	/**
	 * @param {string} title
	 */
	function handleDeleteSubmit(title) {
		return ({ cancel }) => {
			if (!confirm(`Delete “${title}”? This cannot be undone.`)) {
				cancel();
				return;
			}
			return handlePagesSubmit();
		};
	}

	/**
	 * @param {string} key
	 * @param {unknown} value
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

	/**
	 * @param {unknown} value
	 */
	function hrefInvalid(value) {
		return !isSafeHref(typeof value === 'string' ? value : String(value ?? ''));
	}

	/**
	 * @param {{ key: string, kindKey?: string }} field
	 * @param {'block' | 'header' | 'footer'} scope
	 * @param {string | null} instanceId
	 * @param {string | null} [listKey]
	 * @param {number | null} [itemIndex]
	 * @returns {import('#lib/builder/builder.svelte.js').MediaPickTarget}
	 */
	function mediaTarget(field, scope, instanceId, listKey = null, itemIndex = null) {
		return {
			scope,
			instanceId,
			listKey,
			itemIndex,
			idKey: field.key,
			kindKey: field.kindKey ?? 'imageKind'
		};
	}

	/**
	 * @param {import('#lib/builder/builder.svelte.js').MediaPickTarget} target
	 */
	function pickIsActive(target) {
		const pick = builder.mediaPick;
		if (!pick) return false;
		return (
			pick.scope === target.scope &&
			pick.instanceId === target.instanceId &&
			pick.listKey === target.listKey &&
			pick.itemIndex === target.itemIndex &&
			pick.idKey === target.idKey
		);
	}

	/**
	 * Missing booleans follow the field default so existing heroes stay bordered and buttoned.
	 * @param {Record<string, unknown>} props
	 * @param {{ key: string, default?: boolean }} field
	 */
	function isFieldOn(props, field) {
		const value = props[field.key];
		if (value === undefined || value === null) return field.default === true;
		return value === true;
	}
</script>

{#snippet selectField(label, value, options, onchange)}
	{@const current = String(value ?? '')}
	<label>
		<span>{label}</span>
		<select value={current} onchange={(e) => onchange(e.currentTarget.value)}>
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
			{#if current && !options.some((option) => option.value === current)}
				<option value={current}>{current}</option>
			{/if}
		</select>
	</label>
{/snippet}

{#snippet urlField(label, value, oninput)}
	{@const invalid = hrefInvalid(value)}
	<label>
		<span>{label}</span>
		<input
			type="text"
			inputmode="url"
			value={String(value ?? '')}
			aria-invalid={invalid}
			oninput={(e) => oninput(e.currentTarget.value)}
		/>
		{#if invalid}
			<span class="field-error" role="alert">Use a /path, http(s) URL, or mailto: address.</span>
		{/if}
	</label>
{/snippet}

{#snippet mediaSlot(label, idValue, kindValue, picking, onpick, onclear)}
	{@const src = siteMediaUrl(idValue)}
	<div class="media-slot" class:picking>
		<span>{label}</span>
		<div class="media-slot-row">
			{#if src}
				{#if kindValue === 'video'}
					<video {src} muted playsinline preload="metadata"></video>
				{:else}
					<img {src} alt="" />
				{/if}
			{:else}
				<span class="media-slot-empty">None</span>
			{/if}
			<button type="button" class="media-btn" onclick={onpick}>Library</button>
			{#if src}
				<button type="button" class="media-btn" onclick={onclear}>Clear</button>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet chromePicker(kind, catalog, activeType, onchoose)}
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
						onchoose?.();
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

{#snippet chromeFields(kind, instance, def, skip = [])}
	{#if instance && def}
		<div class="fields" class:dense={kind === 'header'}>
			{#each def.fields.filter((field) => !skip.includes(field.key)) as field (field.key)}
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
							{#if kind === 'header'}
								{@const linkHref = item.href}
								<div class="nav-link">
									<input
										type="text"
										aria-label="Link {itemIndex + 1} label"
										placeholder="Label"
										value={String(item.label ?? '')}
										oninput={(e) =>
											builder.updateChromeListItem(
												kind,
												field.key,
												itemIndex,
												'label',
												e.currentTarget.value
											)}
									/>
									<input
										type="text"
										inputmode="url"
										aria-label="Link {itemIndex + 1} URL"
										placeholder="/path"
										aria-invalid={hrefInvalid(linkHref)}
										value={String(linkHref ?? '')}
										oninput={(e) =>
											builder.updateChromeListItem(
												kind,
												field.key,
												itemIndex,
												'href',
												e.currentTarget.value
											)}
									/>
									<button
										type="button"
										class="icon-btn"
										aria-label="Remove link {itemIndex + 1}"
										onclick={() => builder.removeChromeListItem(kind, field.key, itemIndex)}
									>
										<IconTrash size={14} stroke={1.75} aria-hidden="true" />
									</button>
								</div>
								{#if hrefInvalid(linkHref)}
									<span class="field-error" role="alert"
										>Use a /path, http(s) URL, or mailto: address.</span
									>
								{/if}
							{:else}
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
										{#if itemField.kind === 'url'}
											{@render urlField(itemField.label, item[itemField.key], (value) =>
												builder.updateChromeListItem(
													kind,
													field.key,
													itemIndex,
													itemField.key,
													value
												)
											)}
										{:else if itemField.kind === 'media'}
											{@const target = mediaTarget(
												itemField,
												kind,
												instance.id,
												field.key,
												itemIndex
											)}
											{@render mediaSlot(
												itemField.label,
												item[itemField.key],
												item[itemField.kindKey ?? 'imageKind'],
												pickIsActive(target),
												() => builder.openMediaPicker(target),
												() => builder.clearMedia(target)
											)}
										{:else}
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
										{/if}
									{/each}
								</div>
							{/if}
						{/each}
					</section>
				{:else if field.kind === 'url'}
					{@render urlField(field.label, instance.props[field.key], (value) =>
						builder.updateChromeProps(kind, { [field.key]: value })
					)}
				{:else if field.kind === 'media'}
					{@const target = mediaTarget(field, kind, instance.id)}
					{@render mediaSlot(
						field.label,
						instance.props[field.key],
						instance.props[field.kindKey ?? 'imageKind'],
						pickIsActive(target),
						() => builder.openMediaPicker(target),
						() => builder.clearMedia(target)
					)}
				{:else if field.kind === 'boolean'}
					<label class="boolean-field">
						<input
							type="checkbox"
							checked={isFieldOn(instance.props, field)}
							onchange={(e) =>
								builder.updateChromeProps(kind, {
									[field.key]: e.currentTarget.checked
								})}
						/>
						<span>{field.label}</span>
					</label>
				{:else if field.kind === 'select'}
					{@render selectField(
						field.label,
						instance.props[field.key],
						field.options ?? [],
						(value) => builder.updateChromeProps(kind, { [field.key]: value })
					)}
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

<FloatingHud id="inspector" title="Inspector" resizable collapsible neutral>
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
				<form
					class="create-page"
					method="POST"
					action="?/createPage"
					aria-label="Create flat page"
					aria-busy={submitting}
					use:enhance={handlePagesSubmit}
				>
					<label>
						<span>Page title</span>
						<input
							name="title"
							type="text"
							value={pagesForm?.title ?? ''}
							maxlength="120"
							required
						/>
					</label>
					<label>
						<span>Slug</span>
						<input
							name="slug"
							type="text"
							value={pagesForm?.slug ?? ''}
							placeholder="about"
							maxlength="80"
							required
						/>
					</label>
					<button type="submit" class="save create" disabled={submitting}>
						<IconPlus size={14} stroke={1.75} aria-hidden="true" />
						{submitting ? 'Creating…' : 'Add page'}
					</button>
				</form>

				{#if pagesForm?.pagesMessage && !submitting}
					<p class="form-error pages-message" role="alert" aria-live="polite">
						{pagesForm.pagesMessage}
					</p>
				{/if}
				{#if pagesForm?.pagesSuccess && !submitting}
					<p class="form-ok pages-message" role="status">{pagesForm.pagesSuccess}</p>
				{/if}

				<ul class="tree" aria-label="Site pages">
					{#each builder.pages as page (page.id)}
						{@const depth = depthById.get(page.id) ?? 0}
						<li style:--depth={depth}>
							<div class="tree-entry">
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
								{#if page.path !== '/'}
									<form
										class="delete-page"
										method="POST"
										action="?/deletePage"
										aria-label="Delete {page.title}"
										use:enhance={handleDeleteSubmit(page.title)}
									>
										<input type="hidden" name="pageId" value={page.id} />
										<button
											type="submit"
											class="icon-btn delete-page-btn"
											aria-label="Delete {page.title}"
											title="Delete page"
											disabled={submitting}
										>
											<IconTrash size={14} stroke={1.75} aria-hidden="true" />
										</button>
									</form>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
				<p class="hint">Root is permanent. Other pages publish at a flat /slug path.</p>
			</div>
		{:else if builder.inspectorTab === 'page'}
			<div class="panel" role="tabpanel" aria-label="Page properties">
				{#if !current}
					<p class="hint">Select a page from the Pages tab.</p>
				{:else}
					<BlockLayers />
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
						appearanceModes={['light', 'dark', 'user']}
						onAccentChange={(hex) => builder.setAccentColor(hex)}
						onAppearanceChange={(value) => builder.setAppearance(value)}
						hint="Light/Dark lock the preview. User lets visitors (and the header toggle) switch."
						idPrefix="site-theme"
					/>

					<div class="persona-row">
						<span id="site-persona-label">Persona</span>
						<select
							aria-labelledby="site-persona-label"
							value={builder.themePersona}
							onchange={(event) =>
								builder.setThemePersona(
									/** @type {HTMLSelectElement} */ (event.currentTarget).value
								)}
						>
							{#each THEME_PERSONA_OPTIONS as option (option.id)}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
					</div>

					{#if builder.themeChips.length === 6}
						<PersonaPaletteEditor
							chips={builder.themeChips}
							onReorder={(from, to) => builder.reorderThemeChips(from, to)}
							onOverride={(index, hex) => builder.setThemeChipHex(index, hex)}
						/>
					{/if}

					{#if builder.savingTheme}
						<p class="form-ok" role="status">Saving theme…</p>
					{:else if builder.themeError}
						<p class="form-error" role="alert">{builder.themeError}</p>
					{/if}
				</section>

				<SiteBackgroundControls media={logoMedia} fallback={backgroundFallback} />

				<section
					class="chrome-section nav-section"
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
							Navbar
						</button>
					</header>

					<div class="layout-card">
						<button
							type="button"
							class="layout-toggle"
							aria-expanded={headerLayoutsOpen}
							aria-controls="header-layouts"
							onclick={() => {
								builder.selectChrome('header');
								headerLayoutsOpen = !headerLayoutsOpen;
							}}
						>
							<span class="layout-mini" aria-hidden="true">
								{#if headerDef}
									{@const LayoutPreview = headerDef.preview}
									<LayoutPreview />
								{/if}
							</span>
							<span class="layout-copy">
								<span class="kicker">Layout</span>
								<span class="layout-name">{headerDef?.label ?? 'Choose a layout'}</span>
							</span>
							<span class="layout-action">
								{headerLayoutsOpen ? 'Close' : 'Change'}
								<span class="layout-chevron" class:open={headerLayoutsOpen}>
									<IconChevronDown size={16} stroke={1.75} aria-hidden="true" />
								</span>
							</span>
						</button>
						<div class="layout-drawer" class:open={headerLayoutsOpen} id="header-layouts">
							<div class="layout-drawer-clip" inert={!headerLayoutsOpen}>
								{@render chromePicker(
									'header',
									headerBlockCatalog,
									builder.header?.type ?? null,
									() => {
										headerLayoutsOpen = false;
									}
								)}
							</div>
						</div>
					</div>

					<div class="nav-switches" role="group" aria-label="Navbar behavior">
						<button
							type="button"
							class="hud-switch"
							role="switch"
							aria-checked={headerHideOnScroll}
							onclick={() => setHeaderFlag('hideOnScroll', !headerHideOnScroll)}
						>
							<span class="hud-switch-copy">
								<span class="hud-switch-label">Hide on scroll</span>
								<span class="hud-switch-hint">Slides away after a short scroll down</span>
							</span>
							<span class="hud-knob-track" aria-hidden="true"><span class="hud-knob"></span></span>
						</button>
						<button
							type="button"
							class="hud-switch"
							role="switch"
							aria-checked={headerShowCta}
							aria-expanded={headerShowCta}
							aria-controls="nav-cta-fields"
							onclick={() => setHeaderFlag('showCta', !headerShowCta)}
						>
							<span class="hud-switch-copy">
								<span class="hud-switch-label">Call to action</span>
								<span class="hud-switch-hint">Button at the end of the bar</span>
							</span>
							<span class="hud-knob-track" aria-hidden="true"><span class="hud-knob"></span></span>
						</button>
						{#if headerShowCta && builder.header}
							<div class="cta-fields" id="nav-cta-fields">
								<label>
									<span>Label</span>
									<input
										type="text"
										value={String(builder.header.props.ctaLabel ?? '')}
										oninput={(e) =>
											builder.updateChromeProps('header', { ctaLabel: e.currentTarget.value })}
									/>
								</label>
								{@render urlField('URL', builder.header.props.ctaHref, (value) =>
									builder.updateChromeProps('header', { ctaHref: value })
								)}
							</div>
						{/if}
					</div>

					<LogoMediaSelect
						media={logoMedia}
						fallback={logoFallback}
						selectedId={builder.logoTrackId}
						onPick={(id) => builder.setLogoTrack(id)}
					/>
					{#if builder.logoError}
						<p class="form-error" role="alert">{builder.logoError}</p>
					{/if}
					<ChromeAccentControl
						label="Accent"
						value={builder.headerAccent}
						fallback={siteAccent}
						onChange={(hex) => builder.setHeaderAccent(hex)}
						onClear={() => builder.clearHeaderAccent()}
					/>
					{@render chromeFields('header', builder.header, headerDef, ['ctaLabel', 'ctaHref'])}
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
					<ChromeAccentControl
						label="Footer accent"
						value={builder.footerAccent}
						fallback={siteAccent}
						onChange={(hex) => builder.setFooterAccent(hex)}
						onClear={() => builder.clearFooterAccent()}
					/>
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

					{#if selected.type === 'catalog.stream'}
						<StreamInspector
							props={selected.props}
							items={catalogItems}
							onChange={(patch) => builder.updateBlockProps(selected.id, patch)}
						/>
					{:else}
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
													{#if itemField.kind === 'url'}
														{@render urlField(itemField.label, item[itemField.key], (value) =>
															builder.updateBlockListItem(
																selected.id,
																field.key,
																itemIndex,
																itemField.key,
																value
															)
														)}
													{:else if itemField.kind === 'media'}
														{@const target = mediaTarget(
															itemField,
															'block',
															selected.id,
															field.key,
															itemIndex
														)}
														{@render mediaSlot(
															itemField.label,
															item[itemField.key],
															item[itemField.kindKey ?? 'imageKind'],
															pickIsActive(target),
															() => builder.openMediaPicker(target),
															() => builder.clearMedia(target)
														)}
													{:else}
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
													{/if}
												{/each}
											</div>
										{/each}
									</section>
								{:else if field.kind === 'url'}
									{@render urlField(field.label, selected.props[field.key], (value) =>
										setProp(field.key, value)
									)}
								{:else if field.kind === 'media'}
									{@const target = mediaTarget(field, 'block', selected.id)}
									{@render mediaSlot(
										field.label,
										selected.props[field.key],
										selected.props[field.kindKey ?? 'imageKind'],
										pickIsActive(target),
										() => builder.openMediaPicker(target),
										() => builder.clearMedia(target)
									)}
								{:else if field.kind === 'boolean'}
									<label class="boolean-field">
										<input
											type="checkbox"
											checked={isFieldOn(selected.props, field)}
											onchange={(e) => setProp(field.key, e.currentTarget.checked)}
										/>
										<span>{field.label}</span>
									</label>
								{:else if field.kind === 'select'}
									{@render selectField(
										field.label,
										selected.props[field.key],
										field.options ?? [],
										(value) => setProp(field.key, value)
									)}
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
												value={String(selected.props[field.key] ?? '')}
												oninput={(e) => setProp(field.key, e.currentTarget.value)}
											/>
										{/if}
									</label>
								{/if}
							{/each}
						</div>
					{/if}

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
		background: var(--hud-wash-strong);
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

	.persona-row {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.45rem 0.7rem;
		color: var(--ink);
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.persona-row select {
		min-width: 7.5rem;
		padding: 0.3rem 0.4rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
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
		border-color: var(--hud-line);
		background: var(--hud-wash);
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

	.nav-section {
		--nav-label: 5.25rem;
		gap: 0.5rem;
	}

	.layout-card {
		border: 1px solid var(--hud-line);
		border-radius: 0.125rem;
		background: var(--hud-wash);
	}

	.layout-toggle {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.5rem;
		align-items: center;
		width: 100%;
		padding: 0.35rem;
		border: 0;
		background: transparent;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}

	.layout-mini {
		display: block;
		width: 4.25rem;
		height: 2.4rem;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--ink) 4%, var(--paper));
	}

	.layout-mini :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.layout-copy {
		display: grid;
		gap: 0.05rem;
		min-width: 0;
	}

	.kicker,
	.layout-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.kicker {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.layout-name {
		font-size: 0.82rem;
		color: var(--ink);
	}

	.layout-action {
		display: inline-flex;
		gap: 0.15rem;
		align-items: center;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.layout-chevron {
		display: grid;
		place-items: center;
		color: var(--muted);
		transition: transform 180ms ease;
	}

	.layout-chevron.open {
		transform: rotate(180deg);
	}

	.layout-drawer {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 200ms ease;
	}

	.layout-drawer.open {
		grid-template-rows: 1fr;
	}

	.layout-drawer-clip {
		overflow: hidden;
		min-height: 0;
	}

	.layout-drawer .chrome-thumbs {
		padding: 0 0.35rem 0.4rem;
	}

	.nav-switches {
		display: grid;
		border: 1px solid var(--hud-line);
		border-radius: 0.125rem;
		background: var(--hud-wash);
	}

	.hud-switch {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: 2.35rem;
		padding: 0.4rem 0.5rem;
		border: 0;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
		background: transparent;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}

	.nav-switches > :last-child,
	.hud-switch[aria-expanded='true'] {
		border-bottom: 0;
	}

	.hud-switch-copy {
		display: grid;
		gap: 0.05rem;
		min-width: 0;
	}

	.hud-switch-label {
		font-size: 0.78rem;
		letter-spacing: 0.01em;
		text-transform: none;
		color: var(--ink);
	}

	.hud-switch-hint {
		font-size: 0.65rem;
		line-height: 1.3;
		letter-spacing: 0;
		text-transform: none;
		color: var(--muted);
	}

	.hud-knob-track {
		position: relative;
		display: inline-flex;
		flex-shrink: 0;
		box-sizing: border-box;
		width: 2.2rem;
		height: 1.1rem;
		align-items: center;
		padding: 1px;
		border: 1px solid var(--hud-line);
		border-radius: 0.125rem;
		background: var(--hud-wash);
		box-shadow: inset 0 1px 2px color-mix(in srgb, var(--ink) 20%, transparent);
	}

	.hud-switch[aria-checked='true'] .hud-knob-track {
		border-color: var(--hud-line);
		background: var(--hud-ui);
		box-shadow: inset 0 1px 2px color-mix(in srgb, var(--ink) 28%, transparent);
	}

	.hud-knob {
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--ink) 42%, var(--paper));
		box-shadow: 0 1px 1px color-mix(in srgb, var(--ink) 28%, transparent);
		transition: transform 120ms ease;
	}

	.hud-switch[aria-checked='true'] .hud-knob {
		background: var(--on-hud-ui);
		transform: translateX(1.05rem);
	}

	.cta-fields {
		display: grid;
		gap: 0.4rem;
		padding: 0 0.5rem 0.5rem;
	}

	.cta-fields label,
	.fields.dense > label {
		grid-template-columns: var(--nav-label) minmax(0, 1fr);
		align-items: center;
		gap: 0.4rem;
	}

	.cta-fields .field-error {
		grid-column: 1 / -1;
	}

	.nav-section :global(.logo-select),
	.nav-section :global(.accent) {
		display: grid;
		grid-template-columns: var(--nav-label) minmax(0, 1fr);
		align-items: center;
		gap: 0.4rem;
	}

	.nav-section :global(.accent) {
		grid-template-columns: var(--nav-label) auto minmax(0, 1fr);
	}

	.nav-section :global(.accent button) {
		justify-self: start;
	}

	.nav-link {
		display: grid;
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr) auto;
		gap: 0.3rem;
		align-items: center;
	}

	.nav-link input {
		min-width: 0;
		padding: 0.32rem 0.4rem;
		font-size: 0.8rem;
	}

	.nav-section .list-field {
		gap: 0.35rem;
		padding: 0.4rem;
	}

	.nav-section .list-head {
		min-height: 1.5rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.layout-chevron,
		.layout-drawer,
		.hud-knob {
			transition: none;
		}
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
		border-color: var(--hud-ui);
		background: var(--hud-wash);
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

	.create-page {
		margin-bottom: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.create {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
	}

	.pages-message {
		margin-bottom: 0.65rem;
	}

	.tree-entry {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.25rem;
		align-items: center;
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

	.delete-page {
		display: block;
	}

	.delete-page-btn {
		width: 1.9rem;
		height: 1.9rem;
		color: var(--muted);
	}

	.delete-page-btn:hover:not(:disabled) {
		color: var(--ink);
		background: color-mix(in srgb, var(--chroma-red) 12%, var(--paper));
	}

	.delete-page-btn:disabled {
		opacity: 0.45;
		cursor: wait;
	}

	.tree-row:hover {
		background: color-mix(in srgb, var(--ink) 5%, var(--paper));
	}

	.tree-row.active {
		border-color: var(--hud-line);
		background: var(--hud-wash-strong);
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

	.boolean-field {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		min-height: 2rem;
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--hud-line);
		border-radius: 0.125rem;
		background: var(--hud-wash);
		color: var(--ink);
		cursor: pointer;
		user-select: none;
	}

	.boolean-field input {
		width: auto;
		margin: 0;
		accent-color: var(--hud-ui);
	}

	input,
	textarea,
	label select {
		width: 100%;
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--hud-line);
		border-radius: 0.125rem;
		background: var(--hud-wash);
		color: var(--ink);
		font: inherit;
		font-size: 0.85rem;
		text-transform: none;
		letter-spacing: normal;
	}

	label select {
		cursor: pointer;
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

	.media-slot {
		display: grid;
		gap: 0.3rem;
		font-size: 0.7rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.media-slot.picking .media-btn:first-of-type {
		border-color: var(--hud-line);
		background: var(--hud-ui);
		color: var(--on-hud-ui);
	}

	.media-slot-row {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}

	.media-slot-row img,
	.media-slot-row video,
	.media-slot-empty {
		width: 3.2rem;
		height: 2.4rem;
		object-fit: cover;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		background: color-mix(in srgb, var(--ink) 6%, var(--paper));
	}

	.media-slot-empty {
		display: grid;
		place-items: center;
		font-size: 0.6rem;
	}

	.media-btn {
		padding: 0.3rem 0.45rem;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		background: transparent;
		color: var(--ink);
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.form-error {
		margin: 0;
		color: var(--ink);
		background: color-mix(in srgb, var(--chroma-red) 16%, var(--paper));
		border: 1px solid var(--ink);
		padding: 0.4rem 0.5rem;
		font-size: 0.8rem;
	}

	.field-error {
		display: block;
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.75rem;
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
		background: var(--hud-ui);
		color: var(--on-hud-ui);
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
