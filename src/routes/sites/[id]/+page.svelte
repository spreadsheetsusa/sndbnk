<script>
	import { enhance } from '$app/forms';
	import SiteHeader from '#lib/components/SiteHeader.svelte';

	let { data, form } = $props();

	let busy = $state(false);
	let logoPreview = $state(/** @type {string | null} */ (null));

	const nameValue = $derived(form?.name ?? data.site.name);
	const descriptionValue = $derived(form?.description ?? data.site.description);
	const accentValue = $derived(form?.accentColor ?? data.site.accentColor);
	const appearanceValue = $derived(form?.appearance ?? data.site.appearance ?? 'light');
	const intentValue = $derived(form?.siteIntent ?? data.site.siteIntent);
	const wantBlogValue = $derived(form?.wantBlog ?? data.site.wantBlog);
	const wantEventsValue = $derived(form?.wantEvents ?? data.site.wantEvents);
	const wantEcommerceValue = $derived(form?.wantEcommerce ?? data.site.wantEcommerce);
	const descriptionLength = $derived(descriptionValue.length);
	const logoSrc = $derived(logoPreview ?? data.site.logoUrl);

	const intentLabels = {
		tracks: 'Personal tracks',
		mixes: 'DJ mixes',
		podcast: 'Podcast',
		label: 'Label / collective',
		other: 'Something else'
	};

	/**
	 * @param {Event} event
	 */
	function onLogoPick(event) {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		const file = input.files?.[0];
		if (logoPreview) URL.revokeObjectURL(logoPreview);
		logoPreview = file ? URL.createObjectURL(file) : null;
	}
</script>

<svelte:head>
	<title>Set up your site | SNDBNK</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
	<SiteHeader />

	<main>
		<header class="page-head">
			<p class="eyebrow eyebrow-chip accent-text">@{data.profile.username}</p>
			<h1 class="display-face">Set up your site</h1>
			<p class="intro">A few details so your domain feels like yours from the first visit.</p>
		</header>

		<form
			method="POST"
			action="?/completeSetup"
			enctype="multipart/form-data"
			class="setup-form"
			aria-label="Site setup"
			aria-busy={busy}
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					try {
						await update({ reset: false });
					} finally {
						busy = false;
					}
				};
			}}
		>
			{#if form?.message && !busy}
				<p class="form-error" role="alert" aria-live="polite">{form.message}</p>
			{/if}

			<label for="site-name">
				<span>Site name</span>
				<input
					id="site-name"
					name="name"
					type="text"
					required
					maxlength={data.limits.siteName}
					value={nameValue}
					disabled={busy}
					aria-invalid={form?.message ? 'true' : undefined}
				/>
			</label>

			<div class="logo-row">
				{#if logoSrc}
					<img class="logo-thumb" src={logoSrc} alt="" />
				{:else}
					<div class="logo-thumb placeholder" aria-hidden="true">Logo</div>
				{/if}
				<div class="logo-copy">
					<label for="site-logo" class="file-btn"
						>{data.site.logoUrl || logoPreview ? 'Replace logo' : 'Upload logo'}</label
					>
					<input
						id="site-logo"
						class="visually-hidden"
						name="logo"
						type="file"
						accept="image/jpeg,image/png,image/webp"
						disabled={busy}
						onchange={onLogoPick}
					/>
					<p class="hint">
						Optional. JPG, PNG, or WebP up to 2MB. Goes live on your domain right away.
					</p>
				</div>
			</div>

			<label for="site-accent">
				<span>Accent color</span>
				<div class="accent-row">
					<input
						id="site-accent"
						name="accentColor"
						type="text"
						value={accentValue}
						placeholder="#C8FF00"
						autocapitalize="none"
						spellcheck="false"
						pattern={'^#[0-9A-Fa-f]{6}$'}
						disabled={busy}
					/>
					{#if accentValue}
						<span class="accent-swatch" style:background={accentValue} aria-hidden="true"></span>
					{/if}
				</div>
			</label>
			<p class="hint">Optional hex. Leave blank for the default.</p>

			<fieldset class="appearance-fieldset" disabled={busy}>
				<legend>Appearance</legend>
				<div class="appearance-row" role="radiogroup" aria-label="Site appearance">
					<label class="appearance-opt">
						<input
							type="radio"
							name="appearance"
							value="light"
							checked={appearanceValue === 'light'}
						/>
						<span>Light</span>
					</label>
					<label class="appearance-opt">
						<input
							type="radio"
							name="appearance"
							value="dark"
							checked={appearanceValue === 'dark'}
						/>
						<span>Dark</span>
					</label>
					<label class="appearance-opt">
						<input
							type="radio"
							name="appearance"
							value="user"
							checked={appearanceValue === 'user'}
						/>
						<span>User</span>
					</label>
				</div>
				<p class="hint">
					Light/Dark lock the public look. User lets visitors switch via the header toggle.
				</p>
			</fieldset>

			<label for="site-description">
				<span>Short description</span>
				<textarea
					id="site-description"
					name="description"
					rows="3"
					maxlength={data.limits.siteDescription}
					disabled={busy}>{descriptionValue}</textarea
				>
			</label>
			<p class="hint">
				{descriptionLength}/{data.limits.siteDescription} — used as your landing meta description.
			</p>

			<label for="site-intent">
				<span>What is this site for?</span>
				<select id="site-intent" name="siteIntent" required disabled={busy} value={intentValue}>
					<option value="" disabled={Boolean(intentValue)}>Choose one…</option>
					{#each data.intents as intent (intent)}
						<option value={intent}>{intentLabels[intent] ?? intent}</option>
					{/each}
				</select>
			</label>

			<fieldset class="features">
				<legend>Will you need other features later?</legend>
				<p class="hint">Just preferences for now — nothing unlocks yet.</p>
				<label class="check">
					<input name="wantBlog" type="checkbox" checked={wantBlogValue} disabled={busy} />
					<span>Blog</span>
				</label>
				<label class="check">
					<input name="wantEvents" type="checkbox" checked={wantEventsValue} disabled={busy} />
					<span>Events</span>
				</label>
				<label class="check">
					<input
						name="wantEcommerce"
						type="checkbox"
						checked={wantEcommerceValue}
						disabled={busy}
					/>
					<span>Ecommerce</span>
				</label>
			</fieldset>

			<div class="actions">
				<button type="submit" class="pressable" disabled={busy}>
					{busy ? 'Saving…' : 'Continue to builder'}
				</button>
			</div>
		</form>
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
	}

	main {
		width: min(100% - 2 * var(--site-shell-pad-x), var(--site-content-max));
		margin-inline: auto;
		padding-block: 1.25rem 3rem;
	}

	.page-head {
		display: grid;
		gap: 0.35rem;
		margin-bottom: 1.5rem;
	}

	.page-head .intro {
		max-width: 36rem;
		margin: 0;
		color: var(--muted);
	}

	.setup-form {
		display: grid;
		gap: 0.85rem;
		max-width: 28rem;
	}

	.setup-form label,
	.setup-form .logo-copy {
		display: grid;
		gap: 0.35rem;
	}

	.setup-form label > span,
	.features legend {
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.setup-form input[type='text'],
	.setup-form textarea,
	.setup-form select {
		width: 100%;
		padding: 0.55rem 0.65rem;
		border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--ink));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 8%, var(--paper));
		color: var(--ink);
		font: inherit;
	}

	.setup-form textarea {
		resize: vertical;
		min-height: 4.5rem;
	}

	.hint {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.form-error {
		margin: 0;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--ink);
		background: color-mix(in srgb, var(--ink) 8%, var(--paper));
		color: var(--ink);
	}

	.logo-row {
		display: flex;
		gap: 0.85rem;
		align-items: flex-start;
	}

	.logo-thumb {
		flex: 0 0 auto;
		width: 4.5rem;
		height: 4.5rem;
		object-fit: cover;
		border: 1px solid var(--ink);
		background: var(--paper);
	}

	.logo-thumb.placeholder {
		display: grid;
		place-items: center;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.file-btn {
		display: inline-flex;
		width: fit-content;
		padding: 0.4rem 0.7rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 700;
	}

	.file-btn:hover {
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
	}

	.visually-hidden {
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

	.accent-row {
		display: flex;
		gap: 0.65rem;
		align-items: center;
	}

	.accent-swatch {
		width: 1.5rem;
		height: 1.5rem;
		border: 1px solid var(--ink);
		flex: 0 0 auto;
	}

	.appearance-fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	.appearance-fieldset legend {
		margin-bottom: 0.35rem;
		font-weight: 600;
	}

	.appearance-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}

	.appearance-opt {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.65rem;
		border: 1px solid var(--field-border);
		background: var(--field-surface);
		cursor: pointer;
		user-select: none;
	}

	.appearance-opt:has(input:checked) {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, var(--paper));
	}

	.appearance-opt input {
		margin: 0;
	}

	.appearance-fieldset:disabled .appearance-opt {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.features {
		display: grid;
		gap: 0.45rem;
		margin: 0;
		padding: 0.85rem 0 0;
		border: 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}

	.check {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0;
	}

	.check span {
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.actions .pressable {
		padding: 0.55rem 0.9rem;
	}
</style>
