<script>
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';
	import AccentPicker from '#lib/components/AccentPicker.svelte';
	import {
		ACCENTS,
		CUSTOM_ACCENT_ID,
		DEFAULT_CUSTOM_ACCENT,
		normalizeHex
	} from '#lib/stores/brand.js';

	/** @typedef {'light' | 'dark' | 'user'} AppearanceMode */

	/**
	 * @type {{
	 *   accentHex: string,
	 *   appearance: AppearanceMode,
	 *   onAccentChange: (hex: string) => void,
	 *   onAppearanceChange: (value: AppearanceMode) => void,
	 *   appearanceModes?: AppearanceMode[],
	 *   hint?: string,
	 *   idPrefix?: string,
	 *   customHex?: string,
	 *   pickerOpen?: boolean
	 * }}
	 */
	let {
		accentHex,
		appearance,
		onAccentChange,
		onAppearanceChange,
		appearanceModes = /** @type {AppearanceMode[]} */ (['light', 'dark']),
		hint = '',
		idPrefix = 'theme',
		customHex,
		pickerOpen = $bindable(false)
	} = $props();

	const accentLabelId = $derived(`${idPrefix}-accent-label`);
	const appearanceLabelId = $derived(`${idPrefix}-appearance-label`);
	const pickerId = $derived(`${idPrefix}-accent-picker`);

	const normalizedAccent = $derived(normalizeHex(accentHex));
	const selectedId = $derived.by(() => {
		if (!normalizedAccent) return null;
		const preset = ACCENTS.find((option) => option.value === normalizedAccent);
		return preset?.id ?? CUSTOM_ACCENT_ID;
	});

	/** @type {Record<AppearanceMode, string>} */
	const MODE_LABELS = {
		light: 'Light',
		dark: 'Dark',
		user: 'User'
	};

	/** Hex used to seed the picker when it opens. */
	let pickerSeed = $state(DEFAULT_CUSTOM_ACCENT);

	/**
	 * @param {string} id
	 */
	function selectPreset(id) {
		const option = ACCENTS.find((entry) => entry.id === id);
		if (!option) return;
		pickerOpen = false;
		onAccentChange(option.value);
	}

	function toggleCustomAccent() {
		if (pickerOpen) {
			pickerOpen = false;
			return;
		}

		const hex =
			selectedId === CUSTOM_ACCENT_ID
				? (normalizedAccent ?? DEFAULT_CUSTOM_ACCENT)
				: (normalizeHex(customHex) ?? normalizedAccent ?? DEFAULT_CUSTOM_ACCENT);

		pickerSeed = hex;
		pickerOpen = true;
		onAccentChange(hex);
	}

	/**
	 * @param {AppearanceMode} value
	 */
	function selectAppearance(value) {
		if (!appearanceModes.includes(value)) return;
		onAppearanceChange(value);
	}
</script>

<div class="theme-controls">
	<div class="accent-row">
		<span id={accentLabelId}>Accent</span>
		<div class="swatches" role="group" aria-labelledby={accentLabelId}>
			{#each ACCENTS as option (option.id)}
				<button
					type="button"
					class="swatch"
					style:--swatch={option.value}
					aria-pressed={selectedId === option.id}
					aria-label={option.label}
					title={option.label}
					onclick={() => selectPreset(option.id)}
				></button>
			{/each}
			<button
				type="button"
				class="swatch wheel"
				aria-pressed={selectedId === CUSTOM_ACCENT_ID}
				aria-expanded={pickerOpen}
				aria-controls={pickerId}
				aria-label="Custom"
				title="Custom"
				onclick={toggleCustomAccent}
			></button>
		</div>
	</div>

	{#if pickerOpen}
		<div id={pickerId} transition:slide={{ duration: prefersReducedMotion.current ? 0 : 200 }}>
			{#key pickerSeed}
				<AccentPicker value={pickerSeed} onchange={onAccentChange} />
			{/key}
		</div>
	{/if}

	<div class="appearance-row">
		<span id={appearanceLabelId}>Appearance</span>
		<div class="mode-seg" role="group" aria-labelledby={appearanceLabelId}>
			{#each appearanceModes as mode (mode)}
				<button
					type="button"
					class="mode-btn"
					aria-pressed={appearance === mode}
					onclick={() => selectAppearance(mode)}
				>
					{MODE_LABELS[mode]}
				</button>
			{/each}
		</div>
	</div>

	{#if hint}
		<p class="theme-hint">{hint}</p>
	{/if}
</div>

<style>
	.theme-controls {
		display: grid;
	}

	.appearance-row,
	.accent-row {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.45rem 0.7rem;
		color: var(--ink);
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.mode-seg {
		display: inline-flex;
		border: 1px solid var(--ink);
		background: var(--paper);
	}

	.mode-btn {
		padding: 0.28rem 0.5rem;
		border: 0;
		border-right: 1px solid var(--ink);
		background: transparent;
		color: var(--muted);
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.mode-btn:last-child {
		border-right: 0;
	}

	.mode-btn[aria-pressed='true'] {
		background: var(--accent);
		color: var(--on-accent);
	}

	.swatches {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
	}

	.swatch {
		width: 1.15rem;
		height: 1.15rem;
		padding: 0;
		border: 1px solid var(--ink);
		border-radius: 50%;
		background: var(--swatch);
		cursor: pointer;
		transition:
			transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1),
			box-shadow 120ms ease,
			opacity 120ms ease;
	}

	@media (max-width: 720px) {
		.swatches {
			gap: 0.5rem;
		}

		.swatch {
			width: 1.75rem;
			height: 1.75rem;
		}
	}

	.swatch:hover {
		opacity: 0.85;
	}

	.swatch:active,
	.swatch[aria-pressed='true'] {
		box-shadow:
			0 0 0 2px var(--paper),
			0 0 0 3px var(--ink);
		transform: translate(1px, 1px);
	}

	.swatch.wheel {
		background: conic-gradient(
			from 0deg,
			#ff3d3d,
			#ffd93d,
			#5dff3d,
			#3dffd9,
			#3d8aff,
			#b83dff,
			#ff3d8a,
			#ff3d3d
		);
	}

	.theme-hint {
		margin: 0;
		padding: 0 0.7rem 0.45rem;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		line-height: 1.35;
		text-transform: none;
	}
</style>
