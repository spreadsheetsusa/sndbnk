import { browser } from '$app/env';
import { clampBounds, defaultSpawn, HUD_SPECS } from '#lib/builder/hud-bounds.js';
import { getBlockDefinition } from '#lib/components/blocks/registry.js';
import {
	createDefaultChromeBlock,
	isPageBodyBlockType,
	parseBlockLayout
} from '#lib/components/blocks/types.js';

/** @typedef {import('#lib/builder/hud-bounds.js').BuilderHudId} BuilderHudId */
/** @typedef {import('#lib/builder/hud-bounds.js').HudBounds} HudBounds */
/** @typedef {import('#lib/components/blocks/types.js').PageBlockInstance} PageBlockInstance */
/** @typedef {import('#lib/components/blocks/types.js').PageBlockLayout} PageBlockLayout */

/**
 * @param {PageBlockInstance} block
 * @returns {PageBlockInstance}
 */
function cloneBodyBlock(block) {
	const layout = parseBlockLayout(block.layout);
	return {
		id: block.id,
		type: block.type,
		props: structuredClone(block.props ?? {}),
		...(layout ? { layout: { ...layout } } : {})
	};
}

/**
 * @typedef {{
 *   id: string,
 *   siteId: string,
 *   parentId: string | null,
 *   slug: string,
 *   path: string,
 *   title: string,
 *   seoTitle: string,
 *   seoDescription: string,
 *   blocks?: PageBlockInstance[],
 *   sortOrder: number,
 *   updatedAt: number
 * }} BuilderPage
 */

const STORAGE_KEY = 'sndbnk:builder-hud';
const BLOCK_MIME = 'application/x-sndbnk-block';
const PERSIST_DEBOUNCE_MS = 320;

/** @typedef {null | 'block'} BuilderTool */
/** @typedef {'pages' | 'page' | 'site' | 'block'} InspectorTab */
/** @typedef {null | 'header' | 'footer'} ChromeKind */
/** @typedef {'light' | 'dark'} SiteAppearance */

/**
 * @param {unknown} value
 * @returns {value is HudBounds}
 */
function isBounds(value) {
	if (typeof value !== 'object' || value === null) return false;
	const b = /** @type {Record<string, unknown>} */ (value);
	return (
		typeof b.x === 'number' &&
		typeof b.y === 'number' &&
		typeof b.w === 'number' &&
		typeof b.h === 'number'
	);
}

/**
 * @param {PageBlockInstance | null | undefined} block
 * @returns {PageBlockInstance | null}
 */
function cloneBlock(block) {
	if (!block) return null;
	return cloneBodyBlock(block);
}

/**
 * Site-builder UI state (selection, tools, HUD layout, canvas blocks, site chrome).
 */
class Builder {
	/** @type {BuilderPage[]} */
	pages = $state([]);
	/** @type {string | null} */
	currentPageId = $state(null);
	/** @type {InspectorTab} */
	inspectorTab = $state(/** @type {InspectorTab} */ ('pages'));
	/** @type {BuilderTool} */
	tool = $state(/** @type {BuilderTool} */ (null));
	/** Catalog highlight in Blocks HUD. @type {string | null} */
	selectedCatalogType = $state(null);
	/** Selected canvas instance. @type {string | null} */
	selectedInstanceId = $state(null);
	/** Selected site chrome slot. @type {ChromeKind} */
	selectedChrome = $state(/** @type {ChromeKind} */ (null));
	/** Canvas blocks for the current page. @type {PageBlockInstance[]} */
	blocks = $state(/** @type {PageBlockInstance[]} */ ([]));
	/** @type {PageBlockInstance | null} */
	header = $state(/** @type {PageBlockInstance | null} */ (null));
	/** @type {PageBlockInstance | null} */
	footer = $state(/** @type {PageBlockInstance | null} */ (null));
	/** @type {string | null} */
	siteId = $state(null);
	/** @type {string} */
	siteName = $state('');
	/** Site accent hex (`#RRGGBB`) or empty for default. @type {string} */
	accentColor = $state('');
	/** Public / preview appearance. @type {SiteAppearance} */
	appearance = $state(/** @type {SiteAppearance} */ ('light'));
	/** @type {boolean} */
	savingBlocks = $state(false);
	/** @type {string | null} */
	blocksError = $state(null);
	/** @type {boolean} */
	savingChrome = $state(false);
	/** @type {string | null} */
	chromeError = $state(null);
	/** @type {boolean} */
	savingTheme = $state(false);
	/** @type {string | null} */
	themeError = $state(null);
	/** @type {Partial<Record<BuilderHudId, HudBounds>>} */
	#hudBounds = {};
	/** @type {ReturnType<typeof setTimeout> | null} */
	#persistTimer = null;
	/** @type {ReturnType<typeof setTimeout> | null} */
	#chromePersistTimer = null;
	/** @type {ReturnType<typeof setTimeout> | null} */
	#themePersistTimer = null;
	/** Bump to ignore stale persist responses. */
	#persistGen = 0;
	/** @type {number} */
	#chromePersistGen = 0;
	/** @type {number} */
	#themePersistGen = 0;

	constructor() {
		if (!browser) return;
		this.#restoreHudBounds();
	}

	get blocksOpen() {
		return this.tool === 'block';
	}

	get blockMime() {
		return BLOCK_MIME;
	}

	get selectedInstance() {
		return this.blocks.find((b) => b.id === this.selectedInstanceId) ?? null;
	}

	get selectedChromeBlock() {
		if (this.selectedChrome === 'header') return this.header;
		if (this.selectedChrome === 'footer') return this.footer;
		return null;
	}

	/**
	 * Sync pages + blocks + chrome from a load; keep the current selection when it still exists.
	 * @param {{
	 *   siteId: string,
	 *   siteName?: string,
	 *   accentColor?: string,
	 *   appearance?: SiteAppearance,
	 *   header?: PageBlockInstance | null,
	 *   footer?: PageBlockInstance | null,
	 *   pages: BuilderPage[],
	 *   currentPageId: string
	 * }} data
	 */
	hydrate(data) {
		const siteChanging = this.siteId !== data.siteId;
		this.siteId = data.siteId;
		this.siteName = data.siteName ?? '';
		// Keep live theme/chrome across page-metadata reloads; only seed on site change / first load.
		if (siteChanging) {
			this.accentColor = data.accentColor ?? '';
			this.appearance = data.appearance === 'dark' ? 'dark' : 'light';
		}
		if (siteChanging || !this.header) this.header = cloneBlock(data.header);
		if (siteChanging || !this.footer) this.footer = cloneBlock(data.footer);

		const pageChanging =
			!this.currentPageId || !data.pages.some((p) => p.id === this.currentPageId);
		if (pageChanging) {
			this.currentPageId = data.currentPageId;
			this.selectedInstanceId = null;
			this.pages = data.pages;
			const page = data.pages.find((p) => p.id === this.currentPageId);
			this.blocks = (page?.blocks ?? []).map((b) => cloneBodyBlock(b));
			return;
		}
		// Keep the live canvas; only refresh page metadata from the load.
		this.pages = data.pages.map((p) =>
			p.id === this.currentPageId ? { ...p, blocks: this.blocks } : p
		);
	}

	/**
	 * @param {BuilderPage[]} pages
	 */
	setPages(pages) {
		this.pages = pages;
	}

	/**
	 * @param {string} pageId
	 */
	selectPage(pageId) {
		const page = this.pages.find((p) => p.id === pageId);
		if (!page) return;
		this.currentPageId = pageId;
		this.blocks = (page.blocks ?? []).map((b) => cloneBodyBlock(b));
		this.selectedInstanceId = null;
		this.selectedChrome = null;
		this.blocksError = null;
	}

	/**
	 * @param {InspectorTab} tab
	 */
	setInspectorTab(tab) {
		this.inspectorTab = tab;
	}

	/**
	 * @param {BuilderTool} next
	 */
	setTool(next) {
		this.tool = next;
		if (next !== 'block') this.selectedCatalogType = null;
	}

	toggleBlockTool() {
		this.setTool(this.tool === 'block' ? null : 'block');
	}

	/**
	 * @param {string | null} type
	 */
	selectCatalogType(type) {
		this.selectedCatalogType = type;
	}

	/**
	 * @param {string | null} instanceId
	 */
	selectInstance(instanceId) {
		this.selectedInstanceId = instanceId;
		this.selectedChrome = null;
		if (instanceId) this.inspectorTab = 'block';
	}

	/**
	 * @param {ChromeKind} kind
	 */
	selectChrome(kind) {
		this.selectedChrome = kind;
		this.selectedInstanceId = null;
		if (kind) this.inspectorTab = 'site';
	}

	/**
	 * @param {'header' | 'footer'} kind
	 * @param {string} type
	 */
	setChromeType(kind, type) {
		const def = getBlockDefinition(type);
		if (!def) return;
		if (kind === 'header' && def.category !== 'Header') return;
		if (kind === 'footer' && def.category !== 'Footer') return;

		const brand = this.siteName?.trim() || 'Site';
		const seeded = createDefaultChromeBlock(kind, brand, type);
		const props = seeded
			? seeded.props
			: (() => {
					const next = structuredClone(def.defaults);
					if ('logoText' in next) next.logoText = brand;
					if ('copyright' in next && typeof next.copyright === 'string') {
						next.copyright = `© ${brand}`;
					}
					return next;
				})();

		const instance = {
			id: crypto.randomUUID(),
			type,
			props
		};
		if (kind === 'header') this.header = instance;
		else this.footer = instance;
		this.selectedChrome = kind;
		this.inspectorTab = 'site';
		this.persistChrome({ immediate: true });
	}

	/**
	 * @param {'header' | 'footer'} kind
	 * @param {Record<string, unknown>} patch
	 */
	updateChromeProps(kind, patch) {
		const current = kind === 'header' ? this.header : this.footer;
		if (!current) return;
		const next = { ...current, props: { ...current.props, ...patch } };
		if (kind === 'header') this.header = next;
		else this.footer = next;
		this.persistChrome();
	}

	/**
	 * @param {'header' | 'footer'} kind
	 * @param {string} listKey
	 * @param {number} itemIndex
	 * @param {string} fieldKey
	 * @param {unknown} value
	 */
	updateChromeListItem(kind, listKey, itemIndex, fieldKey, value) {
		const current = kind === 'header' ? this.header : this.footer;
		if (!current) return;
		const list = Array.isArray(current.props[listKey]) ? [...current.props[listKey]] : [];
		const item = {
			...(typeof list[itemIndex] === 'object' && list[itemIndex] !== null
				? /** @type {Record<string, unknown>} */ (list[itemIndex])
				: {})
		};
		item[fieldKey] = value;
		list[itemIndex] = item;
		const next = { ...current, props: { ...current.props, [listKey]: list } };
		if (kind === 'header') this.header = next;
		else this.footer = next;
		this.persistChrome();
	}

	/**
	 * @param {'header' | 'footer'} kind
	 * @param {string} listKey
	 * @param {Record<string, unknown>} blank
	 */
	addChromeListItem(kind, listKey, blank) {
		const current = kind === 'header' ? this.header : this.footer;
		if (!current) return;
		const list = Array.isArray(current.props[listKey]) ? [...current.props[listKey]] : [];
		list.push(structuredClone(blank));
		const next = { ...current, props: { ...current.props, [listKey]: list } };
		if (kind === 'header') this.header = next;
		else this.footer = next;
		this.persistChrome();
	}

	/**
	 * @param {'header' | 'footer'} kind
	 * @param {string} listKey
	 * @param {number} itemIndex
	 */
	removeChromeListItem(kind, listKey, itemIndex) {
		const current = kind === 'header' ? this.header : this.footer;
		if (!current) return;
		const list = Array.isArray(current.props[listKey]) ? [...current.props[listKey]] : [];
		list.splice(itemIndex, 1);
		const next = { ...current, props: { ...current.props, [listKey]: list } };
		if (kind === 'header') this.header = next;
		else this.footer = next;
		this.persistChrome();
	}

	/**
	 * @param {string} type
	 * @param {number} [index]
	 */
	insertBlock(type, index) {
		if (!isPageBodyBlockType(type)) return null;
		const def = getBlockDefinition(type);
		if (!def) return null;
		const instance = {
			id: crypto.randomUUID(),
			type,
			props: structuredClone(def.defaults)
		};
		const at =
			typeof index === 'number' && index >= 0 && index <= this.blocks.length
				? index
				: this.blocks.length;
		this.blocks = [...this.blocks.slice(0, at), instance, ...this.blocks.slice(at)];
		this.selectedCatalogType = type;
		this.selectedInstanceId = instance.id;
		this.selectedChrome = null;
		this.inspectorTab = 'block';
		this.persistBlocks({ immediate: true });
		return instance;
	}

	/**
	 * @param {string} instanceId
	 * @param {Record<string, unknown>} patch
	 */
	updateBlockProps(instanceId, patch) {
		this.blocks = this.blocks.map((b) =>
			b.id === instanceId ? { ...b, props: { ...b.props, ...patch } } : b
		);
		this.persistBlocks();
	}

	/**
	 * Set or clear centered max-width layout for a body block.
	 * @param {string} instanceId
	 * @param {PageBlockLayout | null | undefined} layout
	 * @param {{ immediate?: boolean }} [opts]
	 */
	updateBlockLayout(instanceId, layout, opts = {}) {
		const nextLayout = parseBlockLayout(layout);
		this.blocks = this.blocks.map((b) => {
			if (b.id !== instanceId) return b;
			if (!nextLayout) {
				const { layout: _drop, ...rest } = b;
				return rest;
			}
			return { ...b, layout: { ...nextLayout } };
		});
		this.persistBlocks(opts);
	}

	/**
	 * Replace a list prop item field.
	 * @param {string} instanceId
	 * @param {string} listKey
	 * @param {number} itemIndex
	 * @param {string} fieldKey
	 * @param {unknown} value
	 */
	updateBlockListItem(instanceId, listKey, itemIndex, fieldKey, value) {
		this.blocks = this.blocks.map((b) => {
			if (b.id !== instanceId) return b;
			const list = Array.isArray(b.props[listKey]) ? [...b.props[listKey]] : [];
			const item = {
				...(typeof list[itemIndex] === 'object' && list[itemIndex] !== null
					? /** @type {Record<string, unknown>} */ (list[itemIndex])
					: {})
			};
			item[fieldKey] = value;
			list[itemIndex] = item;
			return { ...b, props: { ...b.props, [listKey]: list } };
		});
		this.persistBlocks();
	}

	/**
	 * @param {string} instanceId
	 * @param {string} listKey
	 * @param {Record<string, unknown>} blank
	 */
	addBlockListItem(instanceId, listKey, blank) {
		this.blocks = this.blocks.map((b) => {
			if (b.id !== instanceId) return b;
			const list = Array.isArray(b.props[listKey]) ? [...b.props[listKey]] : [];
			list.push(structuredClone(blank));
			return { ...b, props: { ...b.props, [listKey]: list } };
		});
		this.persistBlocks();
	}

	/**
	 * @param {string} instanceId
	 * @param {string} listKey
	 * @param {number} itemIndex
	 */
	removeBlockListItem(instanceId, listKey, itemIndex) {
		this.blocks = this.blocks.map((b) => {
			if (b.id !== instanceId) return b;
			const list = Array.isArray(b.props[listKey]) ? [...b.props[listKey]] : [];
			list.splice(itemIndex, 1);
			return { ...b, props: { ...b.props, [listKey]: list } };
		});
		this.persistBlocks();
	}

	/**
	 * @param {string} instanceId
	 */
	removeBlock(instanceId) {
		this.blocks = this.blocks.filter((b) => b.id !== instanceId);
		if (this.selectedInstanceId === instanceId) this.selectedInstanceId = null;
		this.persistBlocks({ immediate: true });
	}

	/**
	 * @param {string} instanceId
	 * @param {number} toIndex
	 */
	moveBlock(instanceId, toIndex) {
		const from = this.blocks.findIndex((b) => b.id === instanceId);
		if (from < 0) return;
		const next = [...this.blocks];
		const [item] = next.splice(from, 1);
		const clamped = Math.max(0, Math.min(toIndex, next.length));
		next.splice(clamped, 0, item);
		this.blocks = next;
		this.persistBlocks({ immediate: true });
	}

	/**
	 * @param {{ immediate?: boolean }} [opts]
	 */
	persistBlocks(opts = {}) {
		if (!browser || !this.siteId || !this.currentPageId) return;
		if (this.#persistTimer) {
			clearTimeout(this.#persistTimer);
			this.#persistTimer = null;
		}
		const run = () => {
			this.#persistTimer = null;
			void this.#flushBlocks();
		};
		if (opts.immediate) run();
		else this.#persistTimer = setTimeout(run, PERSIST_DEBOUNCE_MS);
	}

	/**
	 * @param {{ immediate?: boolean }} [opts]
	 */
	persistChrome(opts = {}) {
		if (!browser || !this.siteId || !this.header || !this.footer) return;
		if (this.#chromePersistTimer) {
			clearTimeout(this.#chromePersistTimer);
			this.#chromePersistTimer = null;
		}
		const run = () => {
			this.#chromePersistTimer = null;
			void this.#flushChrome();
		};
		if (opts.immediate) run();
		else this.#chromePersistTimer = setTimeout(run, PERSIST_DEBOUNCE_MS);
	}

	/**
	 * @param {string} value
	 */
	setAccentColor(value) {
		this.accentColor = value;
		const trimmed = value.trim();
		// Debounce-persist only empty (default) or a complete hex; ignore mid-edit.
		if (!trimmed || /^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
			this.persistTheme();
		}
	}

	/**
	 * @param {SiteAppearance} value
	 */
	setAppearance(value) {
		this.appearance = value === 'dark' ? 'dark' : 'light';
		this.persistTheme({ immediate: true });
	}

	/**
	 * @param {{ immediate?: boolean }} [opts]
	 */
	persistTheme(opts = {}) {
		if (!browser || !this.siteId) return;
		if (this.#themePersistTimer) {
			clearTimeout(this.#themePersistTimer);
			this.#themePersistTimer = null;
		}
		const run = () => {
			this.#themePersistTimer = null;
			void this.#flushTheme();
		};
		if (opts.immediate) run();
		else this.#themePersistTimer = setTimeout(run, PERSIST_DEBOUNCE_MS);
	}

	async #flushBlocks() {
		if (!this.siteId || !this.currentPageId) return;
		const gen = ++this.#persistGen;
		const payload = this.blocks.map((b) => {
			const layout = parseBlockLayout(b.layout);
			return {
				id: b.id,
				type: b.type,
				props: b.props,
				...(layout ? { layout } : {})
			};
		});
		this.savingBlocks = true;
		this.blocksError = null;
		try {
			const res = await fetch(`/api/sites/${this.siteId}/pages/${this.currentPageId}/blocks`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ blocks: payload })
			});
			if (gen !== this.#persistGen) return;
			if (!res.ok) {
				const text = await res.text();
				this.blocksError = text || 'Could not save blocks.';
				return;
			}
			const data = await res.json();
			this.pages = this.pages.map((p) =>
				p.id === this.currentPageId
					? { ...p, blocks: data.blocks, updatedAt: data.updatedAt ?? p.updatedAt }
					: p
			);
		} catch {
			if (gen !== this.#persistGen) return;
			this.blocksError = 'Could not save blocks.';
		} finally {
			if (gen === this.#persistGen) this.savingBlocks = false;
		}
	}

	async #flushChrome() {
		if (!this.siteId || !this.header || !this.footer) return;
		const gen = ++this.#chromePersistGen;
		this.savingChrome = true;
		this.chromeError = null;
		try {
			const res = await fetch(`/api/sites/${this.siteId}/chrome`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ header: this.header, footer: this.footer })
			});
			if (gen !== this.#chromePersistGen) return;
			if (!res.ok) {
				const text = await res.text();
				this.chromeError = text || 'Could not save site chrome.';
				return;
			}
			const data = await res.json();
			if (data.header) this.header = cloneBlock(data.header);
			if (data.footer) this.footer = cloneBlock(data.footer);
		} catch {
			if (gen !== this.#chromePersistGen) return;
			this.chromeError = 'Could not save site chrome.';
		} finally {
			if (gen === this.#chromePersistGen) this.savingChrome = false;
		}
	}

	async #flushTheme() {
		if (!this.siteId) return;
		const gen = ++this.#themePersistGen;
		this.savingTheme = true;
		this.themeError = null;
		try {
			const res = await fetch(`/api/sites/${this.siteId}/theme`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					accentColor: this.accentColor,
					appearance: this.appearance
				})
			});
			if (gen !== this.#themePersistGen) return;
			if (!res.ok) {
				const text = await res.text();
				this.themeError = text || 'Could not save site theme.';
				return;
			}
			const data = await res.json();
			if (typeof data.accentColor === 'string') this.accentColor = data.accentColor;
			if (data.appearance === 'light' || data.appearance === 'dark') {
				this.appearance = data.appearance;
			}
		} catch {
			if (gen !== this.#themePersistGen) return;
			this.themeError = 'Could not save site theme.';
		} finally {
			if (gen === this.#themePersistGen) this.savingTheme = false;
		}
	}

	get currentPage() {
		return this.pages.find((p) => p.id === this.currentPageId) ?? null;
	}

	/**
	 * @param {BuilderHudId} id
	 * @returns {HudBounds}
	 */
	resolveHudBounds(id) {
		const viewport = browser
			? { innerWidth: window.innerWidth, innerHeight: window.innerHeight }
			: { innerWidth: 1200, innerHeight: 800 };
		const stored = this.#hudBounds[id];
		if (stored) return clampBounds(stored, HUD_SPECS[id], viewport);
		return defaultSpawn(id, viewport);
	}

	/**
	 * @param {BuilderHudId} id
	 * @param {HudBounds} bounds
	 */
	persistHudBounds(id, bounds) {
		this.#hudBounds = { ...this.#hudBounds, [id]: bounds };
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#hudBounds));
		} catch {
			// Quota / private mode — layout still works for the session.
		}
	}

	#restoreHudBounds() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (typeof parsed !== 'object' || parsed === null) return;
			/** @type {Partial<Record<BuilderHudId, HudBounds>>} */
			const next = {};
			for (const id of /** @type {BuilderHudId[]} */ (['toolbar', 'inspector', 'blocks'])) {
				if (isBounds(parsed[id])) next[id] = parsed[id];
			}
			this.#hudBounds = next;
		} catch {
			// Corrupt storage — fall back to defaults.
		}
	}
}

export const builder = new Builder();
