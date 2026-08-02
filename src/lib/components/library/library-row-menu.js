/** @type {(() => void) | null} */
let closeCurrent = null;

/**
 * Ensure only one library-row menu is open. Call when opening; invoke the
 * returned release when that menu closes.
 *
 * @param {() => void} close
 * @returns {() => void}
 */
export function claimRowMenu(close) {
	if (closeCurrent && closeCurrent !== close) closeCurrent();
	closeCurrent = close;
	return () => {
		if (closeCurrent === close) closeCurrent = null;
	};
}
