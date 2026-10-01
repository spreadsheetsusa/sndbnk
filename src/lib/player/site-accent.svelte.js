/**
 * Canvas accent for the player while a user site is on screen.
 * Null on sndbnk.com so the listener accent store stays in charge.
 * Mutate `hex` / `paint` — do not reassign the object (Svelte only tracks the export).
 * `paint` bumps when a nav or footer accent changes so canvases re-read computed `--accent`.
 */
export const sitePlayerAccent = $state(
	/** @type {{ hex: string | null, paint: number }} */ ({ hex: null, paint: 0 })
);
