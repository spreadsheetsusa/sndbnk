<script>
	import { enhance } from '$app/forms';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';

	const nav = $derived(page.data.nav ?? { name: null, username: null });
	const signedIn = $derived(Boolean(nav.name));

	let open = $state(false);
	/** @type {HTMLDivElement | undefined} */
	let menuWrap = $state();
	/** @type {HTMLButtonElement | undefined} */
	let toggleButton = $state();

	const menuLabel = $derived(open ? 'Close menu' : 'Open menu');

	/**
	 * @param {string} href
	 */
	function current(href) {
		const { pathname } = page.url;
		return pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined;
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	function handleKeydown(event) {
		if (event.key === 'Escape' && open) {
			open = false;
			toggleButton?.focus();
		}
	}

	/**
	 * @param {PointerEvent} event
	 */
	function handlePointerDown(event) {
		if (!open || !menuWrap) return;

		const target = /** @type {Node | null} */ (event.target);
		if (target && !menuWrap.contains(target)) {
			open = false;
		}
	}

	afterNavigate(() => {
		open = false;
	});
</script>

<svelte:window onkeydown={handleKeydown} />
<svelte:document onpointerdown={handlePointerDown} />

{#snippet navLinks()}
	{#if signedIn}
		<a href="/library" aria-current={current('/library')}>Library</a>
		<a href="/settings" aria-current={current('/settings')}>Settings</a>
		{#if nav.username}
			<a href="/users/{nav.username}" aria-current={current(`/users/${nav.username}`)}>
				View profile
			</a>
		{/if}
		<form method="POST" action="/?/signOut" use:enhance>
			<button type="submit">Sign out</button>
		</form>
	{:else}
		<a href="/signin" aria-current={current('/signin')}>Sign in</a>
		<a class="nav-cta" href="/signup" aria-current={current('/signup')}>Create account</a>
	{/if}
{/snippet}

<header class="site-header">
	<a class="logo display-face" href="/" aria-label="SNDBNK home">SNDBNK</a>

	<div class="header-end">
		<nav class="inline-nav" aria-label="Main">
			{@render navLinks()}
		</nav>

		<ThemeToggle />

		<div class="menu-wrap" bind:this={menuWrap}>
			<button
				bind:this={toggleButton}
				type="button"
				class="menu-toggle"
				aria-expanded={open}
				aria-controls="site-menu"
				aria-label={menuLabel}
				title={menuLabel}
				onclick={() => (open = !open)}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
					{#if open}
						<path
							d="M6 6l12 12M18 6L6 18"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
						/>
					{:else}
						<path
							d="M4 7h16M4 12h16M4 17h16"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
						/>
					{/if}
				</svg>
			</button>

			{#if open}
				<nav id="site-menu" class="menu-panel" aria-label="Main menu">
					{@render navLinks()}
				</nav>
			{/if}
		</div>
	</div>
</header>

<style>
	.site-header {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
		min-height: 5rem;
		margin-bottom: var(--site-header-gap, clamp(2rem, 5vw, 3.5rem));
		border-bottom: 1px solid var(--ink);
	}

	.logo {
		color: var(--ink);
		font-size: clamp(1.5rem, 2.5vw, 2.1rem);
		line-height: 1;
		text-decoration: none;
	}

	.header-end {
		display: flex;
		gap: clamp(0.75rem, 2vw, 1.75rem);
		align-items: center;
	}

	.inline-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem clamp(0.75rem, 2vw, 1.75rem);
		align-items: center;
		justify-content: flex-end;
	}

	.inline-nav form {
		display: flex;
		align-items: center;
	}

	.inline-nav a,
	.inline-nav button {
		color: var(--ink);
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-decoration: none;
		text-transform: uppercase;
	}

	.inline-nav button {
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.inline-nav a:not(.nav-cta),
	.inline-nav button {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.3em;
	}

	.inline-nav a[aria-current='page'] {
		text-decoration-thickness: 2px;
	}

	.inline-nav .nav-cta {
		padding: 0.75rem 1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
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
			color 120ms ease;
	}

	.menu-toggle:hover,
	.menu-toggle[aria-expanded='true'] {
		color: var(--accent);
	}

	.menu-toggle:active {
		transform: translate(1px, 1px);
	}

	.menu-toggle svg {
		display: block;
		width: 1.125rem;
		height: 1.125rem;
	}

	.menu-panel {
		position: absolute;
		z-index: 20;
		top: calc(100% + 0.5rem);
		right: 0;
		display: grid;
		min-width: 12rem;
		padding: 0.4rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--ink);
	}

	.menu-panel a,
	.menu-panel button {
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

	.menu-panel a:hover,
	.menu-panel button:hover {
		color: var(--on-accent);
		background: var(--accent);
	}

	@media (max-width: 720px) {
		.site-header {
			min-height: 4.5rem;
		}

		.inline-nav {
			display: none;
		}

		.menu-wrap {
			display: block;
		}
	}
</style>
