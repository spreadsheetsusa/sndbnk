<script>
	import IconLibrary from '@tabler/icons-svelte-runes/icons/library';
	import IconMenu2 from '@tabler/icons-svelte-runes/icons/menu-2';
	import IconRss from '@tabler/icons-svelte-runes/icons/rss';
	import IconUser from '@tabler/icons-svelte-runes/icons/user';
	import IconX from '@tabler/icons-svelte-runes/icons/x';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import AccountMenu from '#lib/components/AccountMenu.svelte';
	import HeaderPlayer from '#lib/components/player/HeaderPlayer.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';

	const nav = $derived(
		page.data.nav ?? {
			id: null,
			name: null,
			username: null,
			image: null,
			isAdmin: false,
			linkedAccounts: [],
			sites: { siteId: null, hosts: [] }
		}
	);
	const signedIn = $derived(Boolean(nav.name));

	let guestMenuOpen = $state(false);

	const guestMenuLabel = $derived(guestMenuOpen ? 'Close menu' : 'Open menu');

	/**
	 * @param {string} href
	 */
	function current(href) {
		const { pathname } = page.url;
		return pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined;
	}

	/** @type {import('svelte/attachments').Attachment} */
	function guestMenuAttach(node) {
		/** @param {PointerEvent} event */
		function onPointerDown(event) {
			if (!guestMenuOpen) return;
			const target = /** @type {Node | null} */ (event.target);
			if (target && !node.contains(target)) {
				guestMenuOpen = false;
			}
		}

		/** @param {KeyboardEvent} event */
		function onKeydown(event) {
			if (event.key !== 'Escape' || !guestMenuOpen) return;
			guestMenuOpen = false;
			node.querySelector('button')?.focus();
		}

		document.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('keydown', onKeydown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('keydown', onKeydown);
		};
	}

	afterNavigate(() => {
		guestMenuOpen = false;
	});
</script>

{#snippet guestLinks()}
	<a href="/plans" aria-current={current('/plans')}>Pricing</a>
	<a href="/signin" aria-current={current('/signin')}>Sign in</a>
	<a class="nav-cta" href="/signup" aria-current={current('/signup')}>Create account</a>
{/snippet}

<header class="site-header">
	<a class="logo display-face glitch-mark" data-text="SNDBNK" href="/" aria-label="SNDBNK home">
		SNDBNK
	</a>

	<HeaderPlayer />

	<div class="header-end">
		{#if signedIn}
			<nav class="mode-strip" aria-label="Primary">
				<a class="mode-btn" href="/feed" aria-current={current('/feed')} aria-label="Feed">
					<IconRss size={16} stroke={1.75} aria-hidden="true" />
					<span class="label">Feed</span>
				</a>
				<a class="mode-btn" href="/library" aria-current={current('/library')} aria-label="Library">
					<IconLibrary size={16} stroke={1.75} aria-hidden="true" />
					<span class="label">Library</span>
				</a>
				{#if nav.username}
					<a
						class="mode-btn"
						href="/users/{nav.username}"
						aria-current={current(`/users/${nav.username}`)}
						aria-label="@{nav.username}"
					>
						<IconUser size={16} stroke={1.75} aria-hidden="true" />
						<span class="label">@{nav.username}</span>
					</a>
				{/if}
			</nav>

			<AccountMenu idPrefix="account" />
		{:else}
			<nav class="inline-nav" aria-label="Main">
				{@render guestLinks()}
			</nav>

			<ThemeToggle />

			<div class="menu-wrap" {@attach guestMenuAttach}>
				<button
					type="button"
					class="menu-toggle"
					aria-expanded={guestMenuOpen}
					aria-haspopup="true"
					aria-controls="site-menu"
					aria-label={guestMenuLabel}
					title={guestMenuLabel}
					onclick={() => (guestMenuOpen = !guestMenuOpen)}
				>
					{#if guestMenuOpen}
						<IconX size={18} stroke={1.75} aria-hidden="true" />
					{:else}
						<IconMenu2 size={18} stroke={1.75} aria-hidden="true" />
					{/if}
				</button>

				{#if guestMenuOpen}
					<nav id="site-menu" class="menu-panel" aria-label="Main menu">
						{@render guestLinks()}
					</nav>
				{/if}
			</div>
		{/if}
	</div>
</header>

<style>
	.site-header {
		/* Extra breathing room above logo/nav; narrow layout raises this. */
		--site-header-pad-top: 0px;
		position: sticky;
		z-index: 40;
		top: 0;
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
		min-height: var(--site-header-height);
		/* black-translucent PWA: paper extends under the notch; pad content below it.
		   Must stay a calc so narrow-layout pad-top cannot wipe the safe-area inset. */
		padding-top: calc(var(--safe-top) + var(--site-header-pad-top));
		margin-bottom: var(--site-header-gap);
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		background: var(--paper);
		user-select: none;
	}

	/* Installed PWA: grow min-height so border-box keeps the inner content box. */
	@media (display-mode: standalone), (display-mode: fullscreen) {
		.site-header {
			--site-header-height: calc(5rem + var(--safe-top) + var(--site-header-pad-top));
		}
	}

	.logo {
		color: var(--ink);
		font-size: clamp(1.5rem, 2.5vw, 2.1rem);
		line-height: 1;
		text-decoration: none;
	}

	.header-end {
		display: flex;
		gap: clamp(0.75rem, 2vw, 1.25rem);
		align-items: center;
	}

	.mode-strip {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 3px 3px 0 var(--hard-shadow);
	}

	.mode-btn {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
		justify-content: center;
		min-height: var(--header-chrome-height);
		padding: 0.4rem 0.85rem;
		border: 0;
		border-right: 1px solid var(--hard-border);
		color: var(--ink);
		background: color-mix(in srgb, var(--paper) 88%, var(--ink));
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		line-height: 1;
		text-decoration: none;
		text-transform: uppercase;
		white-space: nowrap;
		transition:
			transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1),
			background 120ms ease,
			box-shadow 120ms ease,
			color 120ms ease;
	}

	.mode-btn :global(svg) {
		display: none;
		flex-shrink: 0;
	}

	.mode-btn:last-child {
		border-right: 0;
	}

	.mode-btn:hover {
		background: color-mix(in srgb, var(--accent) 35%, var(--paper));
	}

	.mode-btn[aria-current='page'] {
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: inset 2px 2px 0 color-mix(in srgb, var(--ink) 35%, transparent);
		transform: translate(1px, 1px);
	}

	.inline-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem clamp(0.75rem, 2vw, 1.75rem);
		align-items: center;
		justify-content: flex-end;
	}

	.inline-nav a {
		color: var(--ink);
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.3em;
		text-transform: uppercase;
	}

	.inline-nav a[aria-current='page'] {
		text-decoration-thickness: 2px;
	}

	.inline-nav .nav-cta {
		padding: 0.75rem 1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		text-decoration: none;
	}

	.menu-wrap {
		display: none;
		position: relative;
	}

	.menu-toggle {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 0;
		color: var(--ink);
		background: transparent;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1),
			opacity 120ms ease;
	}

	.menu-toggle:hover {
		opacity: 0.55;
	}

	.menu-toggle:active {
		transform: translate(1px, 1px);
	}

	.menu-toggle :global(svg) {
		display: block;
	}

	.menu-panel {
		position: absolute;
		z-index: 20;
		top: calc(100% + 0.5rem);
		right: 0;
		display: grid;
		min-width: 12rem;
		padding: 0.4rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.menu-panel a {
		display: block;
		width: 100%;
		padding: 0.6rem 0.7rem;
		border: 0;
		color: var(--ink);
		background: transparent;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-align: left;
		text-decoration: none;
		text-transform: uppercase;
		cursor: pointer;
	}

	.menu-panel a[aria-current='page'] {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.3em;
	}

	.menu-panel .nav-cta {
		color: var(--on-accent);
		background: var(--accent);
	}

	.menu-panel a:hover {
		color: var(--on-accent);
		background: var(--accent);
	}

	/* Narrow: the player takes its own row instead of squeezing the logo and nav. */
	@media (max-width: 960px) {
		.site-header {
			/* Breathing room above logo/mode strip when the stacked player grows the header
			   past min-height (align-content no longer centers, so content would pack flush).
			   Stacked on --safe-top via padding-top calc — do not set padding-top here. */
			--site-header-pad-top: 0.45rem;
			flex-wrap: wrap;
			align-content: center;
			/* border-box: keep the inner content box at the previous min-height. */
			--site-header-height: calc(5rem + var(--safe-top) + var(--site-header-pad-top));
		}

		.header-end {
			order: 1;
		}
	}

	@media (max-width: 640px) {
		.site-header {
			--site-header-height: calc(4.5rem + var(--safe-top) + var(--site-header-pad-top));
		}

		.mode-btn {
			padding: 0.4rem 0.65rem;
			font-size: 0.65rem;
		}

		.inline-nav {
			display: none;
		}

		.menu-wrap {
			display: block;
		}
	}

	/* Phone-narrow: icon-only mode strip so Feed / Library / @user still fit. */
	@media (max-width: 560px) {
		.mode-btn {
			gap: 0;
			padding: 0.4rem 0.7rem;
		}

		.mode-btn :global(svg) {
			display: block;
		}

		.mode-btn .label {
			display: none;
		}
	}

	@media (pointer: coarse) {
		.mode-btn {
			min-height: var(--tap-min);
		}

		.menu-toggle {
			width: var(--tap-min);
			height: var(--tap-min);
		}
	}
</style>
