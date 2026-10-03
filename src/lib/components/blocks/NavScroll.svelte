<script>
	/**
	 * Sticky navbar shell. When `hideOnScroll` is on, the bar slides away after
	 * a short downward travel and returns on the way up. Near the top it stays put.
	 * @type {{
	 *   hideOnScroll?: boolean,
	 *   children: import('svelte').Snippet
	 * }}
	 */
	let { hideOnScroll = false, children } = $props();

	let concealed = $state(false);

	const PIN_TOP = 48;
	const HIDE_AFTER = 64;
	const REVEAL_AFTER = 28;

	/**
	 * Recreated only when `enabled` changes, so the listener is not rebuilt on unrelated updates.
	 * @param {boolean} enabled
	 * @returns {import('svelte/attachments').Attachment}
	 */
	function concealNavOnScroll(enabled) {
		return () => {
			concealed = false;
			if (!enabled) return;

			let hidden = false;
			let lastY = window.scrollY;
			let travel = 0;

			const apply = () => {
				if (concealed !== hidden) concealed = hidden;
			};

			const onScroll = () => {
				const y = window.scrollY;
				const delta = y - lastY;
				lastY = y;
				if (y <= PIN_TOP) {
					hidden = false;
					travel = 0;
					apply();
					return;
				}
				if (delta === 0) return;
				if ((delta > 0 && travel < 0) || (delta < 0 && travel > 0)) travel = 0;
				travel += delta;
				if (!hidden && travel >= HIDE_AFTER) {
					hidden = true;
					travel = 0;
				} else if (hidden && travel <= -REVEAL_AFTER) {
					hidden = false;
					travel = 0;
				}
				apply();
			};

			window.addEventListener('scroll', onScroll, { passive: true });
			return () => {
				window.removeEventListener('scroll', onScroll);
				concealed = false;
			};
		};
	}
</script>

<div class="nav-scroll" class:concealed {@attach concealNavOnScroll(hideOnScroll)}>
	{@render children()}
</div>

<style>
	.nav-scroll {
		position: sticky;
		top: 0;
		z-index: 30;
		transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.nav-scroll.concealed {
		transform: translateY(-101%);
	}

	.nav-scroll :global(.block-header) {
		position: relative;
		top: auto;
		z-index: auto;
	}

	@media (prefers-reduced-motion: reduce) {
		.nav-scroll {
			transition: none;
		}
	}
</style>
