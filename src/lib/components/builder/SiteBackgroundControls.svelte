<script>
	import { builder } from '#lib/builder/builder.svelte.js';
	import {
		BACKGROUND_ATTACHMENT_LABELS,
		BACKGROUND_ATTACHMENTS,
		BACKGROUND_POSITION_LABELS,
		BACKGROUND_POSITIONS,
		BACKGROUND_SIZE_LABELS,
		BACKGROUND_SIZES
	} from '#lib/builder/site-background.js';
	import LogoMediaSelect from '#lib/components/builder/LogoMediaSelect.svelte';

	/**
	 * @type {{
	 *   media?: Array<{ trackId: string, filename: string, thumbUrl: string }>
	 * }}
	 */
	let { media = [] } = $props();

	/**
	 * @param {'size' | 'position' | 'attachment'} key
	 * @param {Event} event
	 */
	function change(key, event) {
		const value = /** @type {HTMLSelectElement} */ (event.currentTarget).value;
		if (key === 'size') {
			void builder.setBackground({
				size: /** @type {import('#lib/builder/site-background.js').BackgroundSize} */ (value)
			});
		} else if (key === 'position') {
			void builder.setBackground({
				position: /** @type {import('#lib/builder/site-background.js').BackgroundPosition} */ (
					value
				)
			});
		} else {
			void builder.setBackground({
				attachment: /** @type {import('#lib/builder/site-background.js').BackgroundAttachment} */ (
					value
				)
			});
		}
	}
</script>

<section class="background" aria-labelledby="site-bg-heading">
	<h3 id="site-bg-heading">Background</h3>
	<LogoMediaSelect
		{media}
		label="Image"
		selectedId={builder.backgroundTrackId}
		onPick={(trackId) => builder.setBackground({ trackId })}
	/>
	{#if builder.backgroundTrackId}
		<div class="opts">
			<label>
				Size
				<select value={builder.backgroundSize} onchange={(event) => change('size', event)}>
					{#each BACKGROUND_SIZES as size (size)}
						<option value={size}>{BACKGROUND_SIZE_LABELS[size]}</option>
					{/each}
				</select>
			</label>
			<label>
				Position
				<select value={builder.backgroundPosition} onchange={(event) => change('position', event)}>
					{#each BACKGROUND_POSITIONS as position (position)}
						<option value={position}>{BACKGROUND_POSITION_LABELS[position]}</option>
					{/each}
				</select>
			</label>
			<label>
				Attach
				<select
					value={builder.backgroundAttachment}
					onchange={(event) => change('attachment', event)}
				>
					{#each BACKGROUND_ATTACHMENTS as attachment (attachment)}
						<option value={attachment}>{BACKGROUND_ATTACHMENT_LABELS[attachment]}</option>
					{/each}
				</select>
			</label>
		</div>
		<button type="button" class="clear" onclick={() => builder.clearBackground()}>Remove</button>
	{/if}
	{#if builder.backgroundError}
		<p class="form-error" role="alert">{builder.backgroundError}</p>
	{/if}
</section>

<style>
	.background {
		display: grid;
		gap: 0.45rem;
		padding: 0.55rem;
		border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
	}

	h3 {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.opts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.35rem;
	}

	label {
		display: grid;
		gap: 0.2rem;
		min-width: 0;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	select {
		width: 100%;
		min-width: 0;
		padding: 0.25rem 0.3rem;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--ink));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 6%, var(--paper));
		color: var(--ink);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		letter-spacing: normal;
		text-transform: none;
	}

	.clear {
		justify-self: start;
		padding: 0.15rem 0.45rem;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--ink));
		border-radius: 0.125rem;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.form-error {
		margin: 0;
		color: var(--danger, #c44);
		font-size: 0.75rem;
	}
</style>
