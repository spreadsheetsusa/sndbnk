/**
 * Canvas accent for the player while a user site is on screen.
 * Null on sndbnk.com so the listener accent store stays in charge.
 * Mutate `hex` — do not reassign the object (Svelte only tracks the export).
 */
export const sitePlayerAccent = $state(/** @type {{ hex: string | null }} */ ({ hex: null }));
