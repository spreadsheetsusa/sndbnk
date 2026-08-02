/**
 * One popover/menu open at a time. Components claim a unique token when they
 * open; opening another (or close) clears the previous so only one shows.
 */
class OpenMenu {
	/** @type {symbol | null} */
	current = $state(null);

	/** @param {symbol} id */
	open(id) {
		this.current = id;
	}

	/** @param {symbol} id */
	toggle(id) {
		this.current = this.current === id ? null : id;
	}

	/** @param {symbol} id */
	close(id) {
		if (this.current === id) this.current = null;
	}

	closeAll() {
		this.current = null;
	}
}

export const openMenu = new OpenMenu();
