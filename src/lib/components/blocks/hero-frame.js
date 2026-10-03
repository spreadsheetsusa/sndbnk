/**
 * A hero button renders when it is enabled and has a label.
 * Missing `enabled` stays on so existing blocks keep their buttons.
 * @param {unknown} enabled
 * @param {unknown} label
 */
export function showHeroCta(enabled, label) {
	return enabled !== false && String(label ?? '').trim().length > 0;
}

/** Smallest hero image the builder will drag to. */
export const HERO_IMAGE_MIN_PX = 96;

/** Magnetic snap while dragging the image edges. */
export const HERO_IMAGE_SNAP_PX = 10;

/** Inspector presets, in rem, so a drag can land back on those labels. */
export const HERO_IMAGE_PRESETS = [
	{ value: '8rem', rem: 8, label: 'Compact' },
	{ value: '14rem', rem: 14, label: 'Medium' },
	{ value: '22rem', rem: 22, label: 'Large' },
	{ value: '42rem', rem: 42, label: 'Wide' }
];

/**
 * Clamp a dragged image width, then snap to a preset or the slot.
 * The slot is the column the image lives in, so the result never exceeds it.
 * @param {number} width
 * @param {number} slot
 * @param {number} fontPx
 */
export function snapHeroImagePx(width, slot, fontPx) {
	const room = Math.max(1, Math.round(slot));
	const floor = Math.min(HERO_IMAGE_MIN_PX, room);
	const raw = Number.isFinite(width) ? Math.round(width) : room;
	const clamped = Math.min(room, Math.max(floor, raw));
	/** @type {number[]} */
	const targets = [room];
	for (const preset of HERO_IMAGE_PRESETS) {
		const px = Math.round(preset.rem * fontPx);
		if (px >= floor && px <= room) targets.push(px);
	}
	let best = clamped;
	let bestDist = Infinity;
	for (const target of targets) {
		const dist = Math.abs(clamped - target);
		if (dist <= HERO_IMAGE_SNAP_PX && dist < bestDist) {
			best = target;
			bestDist = dist;
		}
	}
	return best;
}

/**
 * Persist a dragged width. Near the layout default clears the override so the
 * frame stays the layout's own size. Other values are a px max; the image uses
 * min(100%, that) and shrinks on a phone.
 * @param {number} px
 * @param {number} defaultPx
 * @param {number} fontPx
 */
export function heroImageWidthValue(px, defaultPx, fontPx) {
	if (Math.abs(px - defaultPx) <= HERO_IMAGE_SNAP_PX) return '';
	for (const preset of HERO_IMAGE_PRESETS) {
		if (Math.abs(px - Math.round(preset.rem * fontPx)) <= 1) return preset.value;
	}
	return `${Math.round(px)}px`;
}

/**
 * @param {number} px
 * @param {number} fontPx
 */
export function heroImageWidthLabel(px, fontPx) {
	for (const preset of HERO_IMAGE_PRESETS) {
		if (Math.abs(px - Math.round(preset.rem * fontPx)) <= 1) return preset.label;
	}
	return `${Math.round(px)}px`;
}
