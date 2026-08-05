<script>
	import IconBold from '@tabler/icons-svelte-runes/icons/bold';
	import IconItalic from '@tabler/icons-svelte-runes/icons/italic';
	import IconLink from '@tabler/icons-svelte-runes/icons/link';
	import IconList from '@tabler/icons-svelte-runes/icons/list';
	import IconListNumbers from '@tabler/icons-svelte-runes/icons/list-numbers';

	/**
	 * @type {{
	 *   id?: string,
	 *   name?: string,
	 *   value: string,
	 *   maxlength: number,
	 *   placeholder?: string,
	 *   rows?: number,
	 *   oninput?: (event: Event & { currentTarget: HTMLTextAreaElement }) => void
	 * }}
	 */
	let {
		id = 'bio',
		name = 'bio',
		value,
		maxlength,
		placeholder = '',
		rows = 4,
		oninput
	} = $props();

	/** @type {HTMLTextAreaElement | undefined} */
	let textarea = $state.raw();

	/**
	 * @param {string} next
	 * @param {number} start
	 * @param {number} end
	 */
	function apply(next, start, end) {
		const el = textarea;
		if (!el) return;
		const clipped = next.slice(0, maxlength);
		el.value = clipped;
		const safeStart = Math.min(start, clipped.length);
		const safeEnd = Math.min(end, clipped.length);
		el.focus();
		el.setSelectionRange(safeStart, safeEnd);
		el.dispatchEvent(new Event('input', { bubbles: true }));
	}

	/**
	 * @param {string} before
	 * @param {string} after
	 * @param {string} [placeholderText]
	 */
	function wrapSelection(before, after, placeholderText = '') {
		const el = textarea;
		if (!el) return;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const text = el.value;
		const selected = text.slice(start, end) || placeholderText;
		const next = text.slice(0, start) + before + selected + after + text.slice(end);
		const innerStart = start + before.length;
		apply(next, innerStart, innerStart + selected.length);
	}

	/**
	 * @param {'ul' | 'ol'} kind
	 */
	function prefixLines(kind) {
		const el = textarea;
		if (!el) return;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const text = el.value;
		const lineStart = text.lastIndexOf('\n', start - 1) + 1;
		const lineEnd = end === 0 ? 0 : text.indexOf('\n', end - 1);
		const blockEnd = lineEnd === -1 ? text.length : lineEnd;
		const block = text.slice(lineStart, blockEnd) || '';
		const lines = block.length > 0 ? block.split('\n') : [''];
		const prefixed = lines
			.map((line, index) => {
				const bare = line.replace(/^\s{0,3}([-*+]|\d+\.)\s+/, '');
				return kind === 'ol' ? `${index + 1}. ${bare}` : `- ${bare}`;
			})
			.join('\n');
		const next = text.slice(0, lineStart) + prefixed + text.slice(blockEnd);
		apply(next, lineStart, lineStart + prefixed.length);
	}

	function insertLink() {
		const el = textarea;
		if (!el) return;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const selected = el.value.slice(start, end);
		const label = selected || 'link text';
		wrapSelection('[', '](https://)', label);
		// Place the caret inside the URL for quick editing.
		queueMicrotask(() => {
			const field = textarea;
			if (!field) return;
			const open = field.value.indexOf('](https://)', start);
			if (open === -1) return;
			const urlStart = open + 2;
			const urlEnd = urlStart + 'https://'.length;
			field.setSelectionRange(urlStart, urlEnd);
		});
	}
</script>

<div class="bio-editor">
	<div class="bio-toolbar" role="toolbar" aria-label="Bio formatting" aria-controls={id}>
		<button
			type="button"
			class="tool"
			title="Bold"
			aria-label="Bold"
			onclick={() => wrapSelection('**', '**', 'bold')}
		>
			<IconBold size={16} stroke={1.75} aria-hidden="true" />
		</button>
		<button
			type="button"
			class="tool"
			title="Italic"
			aria-label="Italic"
			onclick={() => wrapSelection('_', '_', 'italic')}
		>
			<IconItalic size={16} stroke={1.75} aria-hidden="true" />
		</button>
		<button type="button" class="tool" title="Link" aria-label="Link" onclick={insertLink}>
			<IconLink size={16} stroke={1.75} aria-hidden="true" />
		</button>
		<button
			type="button"
			class="tool"
			title="Bullet list"
			aria-label="Bullet list"
			onclick={() => prefixLines('ul')}
		>
			<IconList size={16} stroke={1.75} aria-hidden="true" />
		</button>
		<button
			type="button"
			class="tool"
			title="Numbered list"
			aria-label="Numbered list"
			onclick={() => prefixLines('ol')}
		>
			<IconListNumbers size={16} stroke={1.75} aria-hidden="true" />
		</button>
	</div>

	<textarea
		bind:this={textarea}
		{id}
		class="bio field-full"
		{name}
		{rows}
		{maxlength}
		{placeholder}
		{value}
		{oninput}></textarea>
</div>

<style>
	.bio-editor {
		display: grid;
		gap: 0.35rem;
	}

	.bio-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--field-border);
		border-radius: 0.125rem;
		background: var(--field-surface);
		color: var(--ink);
		cursor: pointer;
	}

	.tool:hover {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--ink));
	}

	.tool:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	textarea.bio {
		box-sizing: border-box;
		width: 100%;
		max-width: 100%;
		min-height: 6rem;
		margin-bottom: 0.35rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--field-border);
		border-radius: 0;
		color: var(--ink);
		background: var(--field-surface);
		font-family: inherit;
		font-size: 0.95rem;
		line-height: 1.45;
		resize: vertical;
		outline: none;
	}

	textarea.bio:focus {
		box-shadow: 4px 4px 0 var(--accent);
	}

	@media (pointer: coarse) {
		.tool {
			width: var(--tap-min);
			height: var(--tap-min);
		}
	}
</style>
