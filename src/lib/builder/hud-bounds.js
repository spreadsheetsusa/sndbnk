/** @typedef {{ x: number, y: number, w: number, h: number }} HudBounds */

export const VIEW_PAD = 8;

/** @typedef {'toolbar' | 'inspector' | 'blocks'} BuilderHudId */

/** @type {Record<BuilderHudId, { w: number, h: number, minW: number, minH: number, lockH?: boolean }>} */
export const HUD_SPECS = {
	toolbar: { w: 72, h: 240, minW: 64, minH: 180, lockH: true },
	inspector: { w: 300, h: 440, minW: 240, minH: 280 },
	blocks: { w: 720, h: 196, minW: 360, minH: 160, lockH: true }
};

/**
 * @param {HudBounds} bounds
 * @param {{ minW: number, minH: number, lockH?: boolean }} spec
 * @param {{ innerWidth: number, innerHeight: number }} viewport
 * @returns {HudBounds}
 */
export function clampBounds(bounds, spec, viewport) {
	const maxW = Math.max(spec.minW, viewport.innerWidth - VIEW_PAD * 2);
	const maxH = Math.max(spec.minH, viewport.innerHeight - VIEW_PAD * 2);
	const w = Math.min(Math.max(bounds.w, spec.minW), maxW);
	const h = spec.lockH
		? Math.min(Math.max(bounds.h, spec.minH), maxH)
		: Math.min(Math.max(bounds.h, spec.minH), maxH);
	const x = Math.min(
		Math.max(bounds.x, VIEW_PAD),
		Math.max(VIEW_PAD, viewport.innerWidth - w - VIEW_PAD)
	);
	const y = Math.min(
		Math.max(bounds.y, VIEW_PAD),
		Math.max(VIEW_PAD, viewport.innerHeight - h - VIEW_PAD)
	);
	return { x, y, w, h };
}

/**
 * @param {BuilderHudId} id
 * @param {{ innerWidth: number, innerHeight: number }} viewport
 * @returns {HudBounds}
 */
export function defaultSpawn(id, viewport) {
	const spec = HUD_SPECS[id];
	const w = Math.min(spec.w, viewport.innerWidth - VIEW_PAD * 2);
	const h = Math.min(spec.h, viewport.innerHeight - VIEW_PAD * 2);

	if (id === 'toolbar') {
		return clampBounds({ x: VIEW_PAD + 8, y: VIEW_PAD + 8, w, h }, spec, viewport);
	}
	if (id === 'inspector') {
		return clampBounds(
			{
				x: Math.max(VIEW_PAD, viewport.innerWidth - w - VIEW_PAD - 8),
				y: VIEW_PAD + 8,
				w,
				h
			},
			spec,
			viewport
		);
	}
	return clampBounds(
		{
			x: Math.max(VIEW_PAD, (viewport.innerWidth - w) / 2),
			y: Math.max(VIEW_PAD, viewport.innerHeight - h - 28),
			w,
			h
		},
		spec,
		viewport
	);
}
