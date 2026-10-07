<script>
	import IconSearch from '@tabler/icons-svelte-runes/icons/search';
	import IconX from '@tabler/icons-svelte-runes/icons/x';

	/**
	 * @type {{
	 *   value: string,
	 *   labelledBy?: string,
	 *   controls?: string,
	 *   oninput: (value: string) => void,
	 *   onclear: () => void
	 * }}
	 */
	let { value, labelledBy, controls, oninput, onclear } = $props();

	const fieldId = $props.id();
</script>

<form class="search stream-interactive" role="search" onsubmit={(event) => event.preventDefault()}>
	<label class="sr" for={fieldId}>Search tracks</label>
	<div class="field">
		<IconSearch size={16} stroke={1.75} aria-hidden="true" />
		<input
			id={fieldId}
			type="search"
			placeholder="Artist, title, or genre"
			autocomplete="off"
			spellcheck="false"
			maxlength="80"
			aria-labelledby={labelledBy}
			aria-controls={controls}
			{value}
			oninput={(event) => oninput(event.currentTarget.value.slice(0, 80))}
		/>
		{#if value}
			<button type="button" class="clear" aria-label="Clear search" onclick={onclear}>
				<IconX size={14} stroke={1.75} aria-hidden="true" />
			</button>
		{/if}
	</div>
</form>

<style>
	.search {
		margin: 0 0 1rem;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.field {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		width: min(100%, 36rem);
		min-height: 2.5rem;
		padding: 0 0.45rem 0 0.7rem;
		border: 1px solid var(--field-border);
		border-radius: 0.125rem;
		background: var(--field-surface);
		color: var(--muted);
	}

	.field:focus-within {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
		color: var(--ink);
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 0.45rem 0;
		border: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 0.95rem;
	}

	input:focus {
		outline: none;
	}

	input::-webkit-search-cancel-button {
		display: none;
	}

	input::placeholder {
		color: var(--muted);
	}

	.clear {
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		padding: 0;
		border: 0;
		border-radius: 0.125rem;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}

	.clear:hover {
		color: var(--ink);
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
</style>
