/** Hold SAVED on the console lamp after a successful persist. */
export const SAVED_HOLD_MS = 1800;

/** @typedef {'SAVING' | 'DIRTY' | 'SAVED' | 'LIVE'} ConsoleStatus */

/**
 * Highest-wins station lamp: SAVING > DIRTY > SAVED > LIVE.
 * @param {{
 *   saving?: boolean,
 *   pending?: boolean,
 *   savedHold?: boolean
 * }} flags
 * @returns {ConsoleStatus}
 */
export function deriveConsoleStatus(flags) {
	if (flags.saving) return 'SAVING';
	if (flags.pending) return 'DIRTY';
	if (flags.savedHold) return 'SAVED';
	return 'LIVE';
}
