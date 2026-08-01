<script>
	import IconMoon from '@tabler/icons-svelte-runes/icons/moon';
	import IconSun from '@tabler/icons-svelte-runes/icons/sun';
	import { resolvedTheme, toggleTheme } from '#lib/stores/theme.js';

	const nextTheme = $derived($resolvedTheme === 'dark' ? 'light' : 'dark');
	const label = $derived(`Switch to ${nextTheme} mode`);
</script>

<button type="button" class="theme-toggle" onclick={toggleTheme} aria-label={label} title={label}>
	{#if $resolvedTheme === 'dark'}
		<IconSun size={18} stroke={1.75} aria-hidden="true" />
	{:else}
		<IconMoon size={18} stroke={1.75} aria-hidden="true" />
	{/if}
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--ink);
		cursor: pointer;
		text-decoration: none;
		flex-shrink: 0;
		transition:
			transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1),
			opacity 120ms ease;
	}

	/* Without a frame to fill, dimming reads better than an accent tint that would
	   lose contrast against the light paper background. */
	.theme-toggle:hover {
		opacity: 0.55;
	}

	.theme-toggle:active {
		transform: translate(1px, 1px);
	}

	.theme-toggle :global(svg) {
		display: block;
	}
</style>
