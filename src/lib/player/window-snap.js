import { browser } from '$app/env';

export const STRIP_SEL = '.header-player .strip';
/** Snap when a raw drag edge is this close to a target edge. */
export const SNAP_PX = 5;
/** Matches `.inline-milkdrop.panel .stage` height. */
export const PANEL_VIZ_HEIGHT_REM = 11;

/**
 * @typedef {{ left: number, top: number, right: number, bottom: number }} SnapRect
 * @typedef {{ x: number, y: number, w: number }} StripDock
 */

/**
 * @param {Element | string | null | undefined} elOrSel
 * @returns {SnapRect | null}
 */
export function rectOf(elOrSel) {
	if (!browser || elOrSel == null) return null;
	const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
	if (!(el instanceof Element)) return null;
	const r = el.getBoundingClientRect();
	if (r.width <= 0 || r.height <= 0) return null;
	return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

/**
 * @returns {number}
 */
export function panelVizHeightPx() {
	if (!browser) return PANEL_VIZ_HEIGHT_REM * 16;
	const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
	return PANEL_VIZ_HEIGHT_REM * (Number.isFinite(fs) && fs > 0 ? fs : 16);
}

/**
 * Strip-aligned dock (x / y / w). Null when the player strip isn't measurable.
 * @returns {StripDock | null}
 */
export function stripDock() {
	const rect = rectOf(STRIP_SEL);
	if (!rect) return null;
	return { x: rect.left, y: rect.bottom, w: rect.right - rect.left };
}

/**
 * @param {{ x: number, y: number, w: number }} bounds
 * @param {StripDock} dock
 * @returns {boolean}
 */
export function isFullySnapped(bounds, dock) {
	return (
		Math.abs(bounds.x - dock.x) <= SNAP_PX &&
		Math.abs(bounds.y - dock.y) <= SNAP_PX &&
		Math.abs(bounds.w - dock.w) <= SNAP_PX
	);
}

/**
 * Dock under the player strip, or under the other float panel when it is strip-snapped.
 * Milkdrop passes `eqOpen`; EQ passes `milkdropOpen` — whoever is already snapped wins.
 * @param {{ eqOpen?: boolean, milkdropOpen?: boolean }} [opts]
 * @returns {StripDock | null}
 */
export function stackDock(opts = {}) {
	const strip = stripDock();
	if (!strip) return null;

	if (opts.eqOpen) {
		const eqRect = rectOf('#header-eq-panel');
		if (eqRect) {
			const eqSnapped = isFullySnapped(
				{ x: eqRect.left, y: eqRect.top, w: eqRect.right - eqRect.left },
				strip
			);
			if (eqSnapped) return { x: strip.x, y: eqRect.bottom, w: strip.w };
		}
	}

	if (opts.milkdropOpen) {
		const vizRect = rectOf('.milkdrop-window');
		if (vizRect) {
			const vizSnapped = isFullySnapped(
				{ x: vizRect.left, y: vizRect.top, w: vizRect.right - vizRect.left },
				strip
			);
			if (vizSnapped) return { x: strip.x, y: vizRect.bottom, w: strip.w };
		}
	}

	return strip;
}

/**
 * EQ strip-dock snap: near strip-bottom Y → Y only; near Y and left/right → full dock.
 * Uses raw drag coords so snap does not trap once docked.
 *
 * @param {{ x: number, y: number }} raw
 * @param {{ w: number, h: number }} size
 * @param {StripDock | null} dock
 * @param {number} [snapPx]
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function snapEqToStripDock(raw, size, dock, snapPx = SNAP_PX) {
	if (!dock) return { x: raw.x, y: raw.y, w: size.w, h: size.h };
	const nearY = Math.abs(raw.y - dock.y) <= snapPx;
	const nearLeft = Math.abs(raw.x - dock.x) <= snapPx;
	const nearRight = Math.abs(raw.x + size.w - (dock.x + dock.w)) <= snapPx;
	if (nearY && (nearLeft || nearRight)) {
		return { x: dock.x, y: dock.y, w: dock.w, h: size.h };
	}
	if (nearY) {
		return { x: raw.x, y: dock.y, w: size.w, h: size.h };
	}
	return { x: raw.x, y: raw.y, w: size.w, h: size.h };
}

/**
 * Magnetic edge snap: co-aligned and adjacent edges on X and/or Y (corners when both).
 *
 * @param {{ x: number, y: number }} raw
 * @param {{ w: number, h: number }} size
 * @param {(SnapRect | null | undefined)[]} targets
 * @param {number} [snapPx]
 * @returns {{ x: number, y: number }}
 */
export function snapPositionToEdges(raw, { w, h }, targets, snapPx = SNAP_PX) {
	/** @type {{ dist: number, value: number } | null} */
	let bestX = null;
	/** @type {{ dist: number, value: number } | null} */
	let bestY = null;

	/**
	 * @param {'x' | 'y'} axis
	 * @param {number} dist
	 * @param {number} value
	 */
	const consider = (axis, dist, value) => {
		if (dist > snapPx) return;
		if (axis === 'x') {
			if (!bestX || dist < bestX.dist) bestX = { dist, value };
			return;
		}
		if (!bestY || dist < bestY.dist) bestY = { dist, value };
	};

	for (const t of targets) {
		if (!t) continue;
		consider('x', Math.abs(raw.x - t.left), t.left);
		consider('x', Math.abs(raw.x + w - t.right), t.right - w);
		consider('x', Math.abs(raw.x - t.right), t.right);
		consider('x', Math.abs(raw.x + w - t.left), t.left - w);

		consider('y', Math.abs(raw.y - t.top), t.top);
		consider('y', Math.abs(raw.y + h - t.bottom), t.bottom - h);
		consider('y', Math.abs(raw.y - t.bottom), t.bottom);
		consider('y', Math.abs(raw.y + h - t.top), t.top - h);
	}

	return {
		x: bestX ? bestX.value : raw.x,
		y: bestY ? bestY.value : raw.y
	};
}

/**
 * First `[data-viz-dock]` under the pointer, skipping the floating Milkdrop window.
 * @param {number} clientX
 * @param {number} clientY
 * @returns {string | null}
 */
export function dockKeyAt(clientX, clientY) {
	if (!browser) return null;
	for (const el of document.elementsFromPoint(clientX, clientY)) {
		if (!(el instanceof Element)) continue;
		if (el.closest('.milkdrop-window')) continue;
		const dock = el.closest('[data-viz-dock]');
		if (dock) return dock.getAttribute('data-viz-dock');
	}
	return null;
}
