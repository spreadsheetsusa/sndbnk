/** @typedef {'eq' | 'milkdrop'} FloatPanelId */

const BASE_Z = 100;
/** @type {FloatPanelId[]} */
const PANEL_IDS = ['eq', 'milkdrop'];

/**
 * Shared stacking for floating player chrome (EQ panel, Milkdrop window).
 * `raise` bumps a panel above the previous frontmost one.
 */
class FloatStack {
	#top = BASE_Z;
	eq = $state(BASE_Z);
	milkdrop = $state(BASE_Z);

	/**
	 * @param {FloatPanelId} id
	 */
	raise = (id) => {
		// Alone at the top → already frontmost. Shared top (initial state) still needs a bump.
		const alone =
			this[id] === this.#top && PANEL_IDS.every((other) => other === id || this[other] < this.#top);
		if (alone) return;
		this.#top += 1;
		this[id] = this.#top;
	};
}

export const floatStack = new FloatStack();
