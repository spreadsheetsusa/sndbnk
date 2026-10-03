<script>
	/**
	 * Compact color override. Empty `value` shows `fallback` (the site theme) without saving it.
	 * @type {{
	 *   label: string,
	 *   value?: string,
	 *   fallback?: string,
	 *   onChange: (hex: string) => void,
	 *   onClear: () => void
	 * }}
	 */
	let { label, value = '', fallback = '#c8ff3d', onChange, onClear } = $props();

	const shown = $derived(value || fallback);
	const id = $derived(label.toLowerCase().replace(/\s+/g, '-'));
</script>

<div class="accent">
	<label for={id}>{label}</label>
	<input
		{id}
		type="color"
		aria-label={label}
		value={shown}
		oninput={(event) => onChange(/** @type {HTMLInputElement} */ (event.currentTarget).value)}
	/>
	{#if value}
		<button type="button" onclick={onClear}>Theme</button>
	{/if}
</div>

<style>
	.accent {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	label {
		flex: 1 1 auto;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	input {
		width: 2rem;
		height: 1.5rem;
		padding: 0;
		border: 1px solid var(--hud-line);
		border-radius: 0.125rem;
		background: transparent;
		cursor: pointer;
	}

	button {
		padding: 0.15rem 0.4rem;
		border: 1px solid var(--hud-line);
		border-radius: 0.125rem;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
	}
</style>
