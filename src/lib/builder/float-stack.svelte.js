/** @typedef {import('#lib/builder/hud-bounds.js').BuilderHudId} BuilderHudId */

const BASE_Z = 200;

/**
 * Stacking for site-builder floating HUDs (separate from player chrome).
 */
class BuilderFloatStack {
	#top = BASE_Z;
	toolbar = $state(BASE_Z);
	inspector = $state(BASE_Z + 1);
	blocks = $state(BASE_Z + 2);

	/**
	 * @param {BuilderHudId} id
	 */
	raise = (id) => {
		if (this[id] === this.#top) return;
		this.#top += 1;
		this[id] = this.#top;
	};
}

export const builderFloatStack = new BuilderFloatStack();
