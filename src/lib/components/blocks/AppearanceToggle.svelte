<script>
	import IconMoon from '@tabler/icons-svelte-runes/icons/moon';
	import IconSun from '@tabler/icons-svelte-runes/icons/sun';

	/**
	 * @type {{
	 *   resolvedAppearance?: 'light' | 'dark',
	 *   onAppearanceToggle?: () => void
	 * }}
	 */
	let { resolvedAppearance = 'light', onAppearanceToggle } = $props();

	const nextLabel = $derived(resolvedAppearance === 'dark' ? 'Switch to light' : 'Switch to dark');
</script>

<button
	type="button"
	class="appearance-toggle"
	aria-label={nextLabel}
	title={nextLabel}
	onclick={(event) => {
		event.stopPropagation();
		onAppearanceToggle?.();
	}}
>
	{#if resolvedAppearance === 'dark'}
		<IconSun size={16} stroke={1.75} aria-hidden="true" />
	{:else}
		<IconMoon size={16} stroke={1.75} aria-hidden="true" />
	{/if}
</button>

<style>
	.appearance-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--theme-2, var(--ink)) 55%, transparent);
		background: color-mix(in srgb, var(--theme-5, var(--paper)) 70%, transparent);
		color: var(--ink);
		cursor: pointer;
		flex: 0 0 auto;
	}

	.appearance-toggle:hover {
		border-color: var(--theme-2, var(--ink));
		color: var(--accent);
	}
</style>
