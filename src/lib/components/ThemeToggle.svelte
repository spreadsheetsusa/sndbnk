<script>
	import { resolvedTheme, toggleTheme } from '#lib/stores/theme.js';

	const nextTheme = $derived($resolvedTheme === 'dark' ? 'light' : 'dark');
	const label = $derived(`Switch to ${nextTheme} mode`);
</script>

<button type="button" class="theme-toggle" onclick={toggleTheme} aria-label={label} title={label}>
	{#if $resolvedTheme === 'dark'}
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.75" />
			<path
				d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
			/>
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path
				d="M16.4 14.2A6.5 6.5 0 0 1 9.8 7.6 6.6 6.6 0 1 0 16.4 14.2Z"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linejoin="round"
			/>
		</svg>
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

	.theme-toggle svg {
		width: 1.125rem;
		height: 1.125rem;
		display: block;
	}
</style>
