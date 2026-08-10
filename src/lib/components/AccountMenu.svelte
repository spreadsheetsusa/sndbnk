<script>
	import { enhance } from '$app/forms';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import ThemeControls from '#lib/components/ThemeControls.svelte';
	import {
		ACCENTS,
		accentColor,
		customAccent,
		setAccent,
		setCustomAccent
	} from '#lib/stores/brand.js';
	import { resolvedTheme, setThemePreference, themePreference } from '#lib/stores/theme.js';

	const uid = $props.id();

	/**
	 * @type {{
	 *   idPrefix?: string,
	 *   align?: 'start' | 'end',
	 *   avatarSize?: string,
	 *   compact?: boolean
	 * }}
	 */
	let { idPrefix = uid, align = 'end', avatarSize = '2.25rem', compact = false } = $props();

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
	const linkedAccounts = $derived(nav.linkedAccounts ?? []);
	const siteHosts = $derived(nav.sites?.hosts ?? []);
	const appearanceValue = $derived(
		$themePreference === 'light' || $themePreference === 'dark' ? $themePreference : $resolvedTheme
	);
	const menuId = $derived(`${idPrefix}-menu`);

	let accountMenuOpen = $state(false);
	let pickerOpen = $state(false);

	/**
	 * @param {string} href
	 */
	function current(href) {
		const { pathname } = page.url;
		return pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined;
	}

	/**
	 * @param {string} hex
	 */
	function handleAccentChange(hex) {
		const preset = ACCENTS.find((option) => option.value === hex);
		if (preset && !pickerOpen) setAccent(preset.id);
		else setCustomAccent(hex);
	}

	/** @type {import('svelte/attachments').Attachment} */
	function accountMenuAttach(node) {
		/** @param {PointerEvent} event */
		function onPointerDown(event) {
			if (!accountMenuOpen) return;
			const target = /** @type {Node | null} */ (event.target);
			if (!target || node.contains(target)) return;

			// Defer so native <select> option picks can apply before the panel unmounts.
			// Only keep open for that case — clicking non-focusable page chrome leaves focus on
			// the avatar button, which must not block dismiss.
			queueMicrotask(() => {
				if (!accountMenuOpen) return;
				const active = document.activeElement;
				if (active instanceof HTMLSelectElement && node.contains(active)) return;
				accountMenuOpen = false;
				pickerOpen = false;
			});
		}

		/** @param {KeyboardEvent} event */
		function onKeydown(event) {
			if (event.key !== 'Escape' || !accountMenuOpen) return;

			if (pickerOpen) {
				pickerOpen = false;
				/** @type {HTMLElement | null} */ (node.querySelector('.wheel'))?.focus();
				return;
			}

			accountMenuOpen = false;
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
		accountMenuOpen = false;
		pickerOpen = false;
	});
</script>

{#if signedIn}
	<div
		class="account-wrap"
		class:align-start={align === 'start'}
		class:compact
		{@attach accountMenuAttach}
	>
		<button
			type="button"
			class="avatar-btn"
			aria-expanded={accountMenuOpen}
			aria-haspopup="true"
			aria-controls={menuId}
			aria-label="Account menu"
			title="Account menu"
			onclick={() => (accountMenuOpen = !accountMenuOpen)}
		>
			<Avatar src={nav.image} name={nav.name} size={avatarSize} />
		</button>

		{#if accountMenuOpen}
			<div id={menuId} class="account-panel" aria-label="Account menu">
				<ThemeControls
					accentHex={$accentColor}
					appearance={appearanceValue === 'dark' ? 'dark' : 'light'}
					customHex={$customAccent}
					bind:pickerOpen
					onAccentChange={handleAccentChange}
					onAppearanceChange={(value) => {
						if (value === 'light' || value === 'dark') setThemePreference(value);
					}}
					{idPrefix}
				/>

				{#if linkedAccounts.length > 0}
					<hr class="account-divider" />
					<div class="linked-switch" role="group" aria-label="Switch account">
						{#each linkedAccounts as peer (peer.userId)}
							<form method="POST" action="/?/switchAccount" use:enhance>
								<input type="hidden" name="userId" value={peer.userId} />
								<button type="submit" class="account-item linked-item">
									<Avatar src={peer.image} name={peer.name} size="1.35rem" alt="" />
									<span class="linked-label">@{peer.username}</span>
								</button>
							</form>
						{/each}
					</div>
				{/if}

				{#if siteHosts.length > 0}
					<hr class="account-divider" />
					<div class="sites-list" role="group" aria-label="Sites">
						{#each siteHosts as host (host.label)}
							<a class="account-item site-host" href={host.href} aria-current={current(host.href)}>
								<span class="site-host-label">{host.label}</span>
							</a>
						{/each}
					</div>
				{/if}

				<hr class="account-divider" />

				<a class="account-item" href="/settings" aria-current={current('/settings')}> Settings </a>

				{#if nav.isAdmin}
					<a class="account-item" href="/admin" aria-current={current('/admin')}>Admin</a>
				{/if}

				<hr class="account-divider" />

				<form method="POST" action="/?/signOut" use:enhance>
					<button type="submit" class="account-item">
						Sign out{nav.username ? ` (${nav.username})` : ''}
					</button>
				</form>
			</div>
		{/if}
	</div>
{/if}

<style>
	.account-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.avatar-btn {
		display: inline-flex;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1),
			opacity 120ms ease;
	}

	.avatar-btn:hover {
		opacity: 0.85;
	}

	.avatar-btn:active,
	.avatar-btn[aria-expanded='true'] {
		transform: translate(1px, 1px);
	}

	.account-panel {
		position: absolute;
		z-index: 50;
		top: calc(100% + 0.5rem);
		right: 0;
		left: auto;
		display: grid;
		min-width: 17rem;
		max-width: calc(100vw - 2 * var(--site-shell-pad-x));
		padding: 0.4rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.account-wrap.align-start .account-panel {
		right: auto;
		left: 0;
	}

	.account-item {
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

	.account-item[aria-current='page'],
	.account-item:hover {
		color: var(--on-accent);
		background: var(--accent);
	}

	.account-divider {
		width: 100%;
		height: 0;
		margin: 0.25rem 0;
		border: 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
	}

	.linked-switch,
	.sites-list {
		display: grid;
		gap: 0.1rem;
	}

	.linked-item {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		text-transform: none;
		letter-spacing: 0.02em;
		font-weight: 700;
	}

	.linked-label,
	.site-host-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.site-host {
		text-transform: none;
		letter-spacing: 0.02em;
		font-weight: 700;
		font-family: var(--font-lcd), monospace;
	}

	.account-panel form {
		display: block;
		margin: 0;
	}

	@media (pointer: coarse) {
		.account-wrap:not(.compact) .avatar-btn {
			min-width: var(--tap-min);
			min-height: var(--tap-min);
			align-items: center;
			justify-content: center;
		}

		.account-item {
			min-height: var(--tap-min);
		}
	}
</style>
