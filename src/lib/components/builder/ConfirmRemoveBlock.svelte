<script>
	import { builder } from '#lib/builder/builder.svelte.js';
	import { getBlockDefinition } from '#lib/components/blocks/registry.js';

	const block = $derived(
		builder.blocks.find((item) => item.id === builder.pendingRemoveId) ?? null
	);
	const label = $derived(block ? (getBlockDefinition(block.type)?.label ?? 'Block') : 'Block');

	const syncDialog = $derived.by(() => {
		const open = builder.pendingRemoveId != null;
		/** @type {import('svelte/attachments').Attachment} */
		return (node) => {
			const dialog = /** @type {HTMLDialogElement} */ (node);
			if (open && !dialog.open) {
				dialog.showModal();
				dialog.querySelector('button.cancel')?.focus();
			} else if (!open && dialog.open) dialog.close();
		};
	});

	/**
	 * Backdrop clicks land on the dialog element itself.
	 * @param {MouseEvent} event
	 */
	function onBackdrop(event) {
		if (event.currentTarget === event.target) builder.cancelRemove();
	}
</script>

<dialog
	{@attach syncDialog}
	aria-labelledby="remove-block-title"
	aria-describedby="remove-block-copy"
	onclose={() => {
		if (builder.pendingRemoveId) builder.cancelRemove();
	}}
	onclick={onBackdrop}
>
	<h2 id="remove-block-title">Remove this block?</h2>
	<p id="remove-block-copy">The {label} block will be removed from this page.</p>
	<div class="actions">
		<button type="button" class="cancel" onclick={() => builder.cancelRemove()}>Cancel</button>
		<button type="button" class="confirm" onclick={() => builder.confirmRemove()}>Remove</button>
	</div>
</dialog>

<style>
	dialog {
		width: min(22rem, calc(100vw - 2rem));
		height: fit-content;
		margin: auto;
		padding: 1.15rem 1.2rem 1rem;
		border: 1px solid var(--hard-border);
		border-radius: 0;
		background: var(--paper);
		color: var(--ink);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	dialog::backdrop {
		background: color-mix(in srgb, var(--ink) 42%, transparent);
	}

	h2 {
		margin: 0 0 0.4rem;
		font-family: var(--font-editorial);
		font-size: 1.45rem;
		font-weight: 500;
		letter-spacing: -0.02em;
	}

	p {
		margin: 0;
		color: var(--muted);
		line-height: 1.45;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1.1rem;
	}

	button {
		padding: 0.45rem 0.75rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.cancel {
		background: var(--paper);
		color: var(--ink);
	}

	.confirm {
		background: var(--ink);
		color: var(--paper);
	}

	.cancel:hover,
	.confirm:hover {
		background: var(--accent);
		color: var(--on-accent);
	}
</style>
