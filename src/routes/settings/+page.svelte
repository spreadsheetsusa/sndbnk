<script>
	import { enhance } from '$app/forms';
	import { PUBLIC_BASE_DOMAIN } from '$app/env/public';
	import SiteHeader from '#lib/components/SiteHeader.svelte';

	let { data, form } = $props();

	let profileBusy = $state(false);
	let planBusy = $state(false);
	let domainBusy = $state(false);
	let storageBusy = $state(false);

	/** @type {string | null} */
	let userAdapter = $state(null);

	const isPremium = $derived(data.profile.plan === 'premium');
	const nameValue = $derived(form?.name ?? data.user.name);
	const usernameValue = $derived(form?.username ?? data.profile.username);
	const domainValue = $derived(form?.customDomain ?? data.profile.customDomain ?? '');
	const selectedAdapter = $derived(userAdapter ?? form?.adapter ?? data.storage.adapter);
	const sshHostValue = $derived(form?.sshHost ?? data.storage.sshHost);
	const sshPortValue = $derived(form?.sshPort ?? String(data.storage.sshPort ?? 22));
	const sshUsernameValue = $derived(form?.sshUsername ?? data.storage.sshUsername);
	const sshRemotePathValue = $derived(form?.sshRemotePath ?? data.storage.sshRemotePath);
	const isSshAdapter = $derived(selectedAdapter === 'ssh');

	/**
	 * @param {'profile' | 'plan' | 'domain' | 'storage'} which
	 */
	function busyHandler(which) {
		return () => {
			if (which === 'profile') profileBusy = true;
			if (which === 'plan') planBusy = true;
			if (which === 'domain') domainBusy = true;
			if (which === 'storage') storageBusy = true;

			return async ({ update }) => {
				try {
					await update();
				} finally {
					if (which === 'profile') profileBusy = false;
					if (which === 'plan') planBusy = false;
					if (which === 'domain') domainBusy = false;
					if (which === 'storage') storageBusy = false;
				}
			};
		};
	}
</script>

<svelte:head>
	<title>Account settings | SNDBNK</title>
	<meta
		name="description"
		content="Manage your SNDBNK profile, plan, domain, and upload storage."
	/>
</svelte:head>

<div class="settings-page">
	<SiteHeader />

	<main>
		<p class="eyebrow eyebrow-chip accent-text">Account</p>
		<h1 class="display-face">Settings</h1>
		<p class="intro">Your identity, plan, and where the world finds you.</p>

		<section class="block" aria-labelledby="profile-heading">
			<div class="block-head">
				<p class="eyebrow">01</p>
				<h2 id="profile-heading">Profile</h2>
				<p>Display name and username. Email stays your sign-in.</p>
			</div>

			{#if form?.profileMessage && !profileBusy}
				<div class="banner error" role="alert">{form.profileMessage}</div>
			{/if}
			{#if form?.profileSuccess && !profileBusy}
				<div class="banner ok" role="status">{form.profileSuccess}</div>
			{/if}

			<form method="POST" action="?/updateProfile" use:enhance={busyHandler('profile')}>
				<label for="name">Display name</label>
				<input id="name" name="name" type="text" value={nameValue} autocomplete="name" required />

				<label for="username">Username</label>
				<input
					id="username"
					name="username"
					type="text"
					value={usernameValue}
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					minlength="3"
					maxlength="30"
					required
				/>
				<p class="hint">
					Path URL: {PUBLIC_BASE_DOMAIN}/users/<strong>{usernameValue || 'you'}</strong>
				</p>

				<label for="email">Email</label>
				<input id="email" type="email" value={data.user.email} disabled />
				<p class="hint">Used for sign-in. Changing email comes later.</p>

				<button class="pressable" type="submit" disabled={profileBusy}>
					{profileBusy ? 'Saving…' : 'Save profile'}
				</button>
			</form>
		</section>

		<section class="block" aria-labelledby="plan-heading">
			<div class="block-head">
				<p class="eyebrow">02</p>
				<h2 id="plan-heading">Plan</h2>
				<p>
					Pick freely for now — payments land later. Current:
					<strong class="plan-pill">{data.profile.plan}</strong>
				</p>
			</div>

			{#if form?.planMessage && !planBusy}
				<div class="banner error" role="alert">{form.planMessage}</div>
			{/if}
			{#if form?.planSuccess && !planBusy}
				<div class="banner ok" role="status">{form.planSuccess}</div>
			{/if}

			<div class="plan-grid">
				{#each ['basic', 'premium'] as planId (planId)}
					{@const detail = data.planDetails[planId]}
					<article class="plan" class:active={data.profile.plan === planId}>
						<h3 class="display-face">{detail.label}</h3>
						<p class="plan-summary">{detail.summary}</p>
						<ul>
							{#each detail.features as feature (feature)}
								<li>{feature}</li>
							{/each}
						</ul>
						<form method="POST" action="?/setPlan" use:enhance={busyHandler('plan')}>
							<input type="hidden" name="plan" value={planId} />
							<button
								class="pressable"
								class:ghost={data.profile.plan === planId}
								type="submit"
								disabled={planBusy || data.profile.plan === planId}
							>
								{data.profile.plan === planId ? 'Current plan' : `Choose ${detail.label}`}
							</button>
						</form>
					</article>
				{/each}
			</div>
		</section>

		<section class="block" aria-labelledby="domain-heading">
			<div class="block-head">
				<p class="eyebrow">03</p>
				<h2 id="domain-heading">Domain</h2>
				<p>
					{#if isPremium}
						Your subdomain is live. Optionally connect a custom domain with a CNAME.
					{:else}
						Upgrade to Premium to unlock <strong>{data.profile.username}.{data.baseDomain}</strong>
						and custom domains.
					{/if}
				</p>
			</div>

			{#if form?.domainMessage && !domainBusy}
				<div class="banner error" role="alert">{form.domainMessage}</div>
			{/if}
			{#if form?.domainSuccess && !domainBusy}
				<div class="banner ok" role="status">{form.domainSuccess}</div>
			{/if}

			{#if isPremium}
				<div class="domain-panel">
					<div class="url-row">
						<span class="url-label">Subdomain</span>
						{#if data.urls.subdomainUrl}
							<a href={data.urls.subdomainUrl}
								>{data.urls.subdomainUrl.replace(/^https?:\/\//, '')}</a
							>
						{/if}
					</div>
					<div class="url-row">
						<span class="url-label">Path</span>
						<a href={data.urls.pathUrl}>{data.urls.pathUrl.replace(/^https?:\/\//, '')}</a>
					</div>
				</div>

				<form
					class="domain-form"
					method="POST"
					action="?/saveDomain"
					use:enhance={busyHandler('domain')}
				>
					<label for="customDomain">Custom domain</label>
					<input
						id="customDomain"
						name="customDomain"
						type="text"
						value={domainValue}
						placeholder="music.example.com"
						autocapitalize="none"
						spellcheck="false"
					/>
					<p class="hint">Enter the hostname visitors will type. No https://.</p>
					<button class="pressable" type="submit" disabled={domainBusy}>
						{domainBusy ? 'Saving…' : 'Save domain'}
					</button>
				</form>

				{#if data.profile.customDomain && data.profile.domainVerifyToken}
					<div class="dns-box" aria-label="DNS instructions">
						<p class="eyebrow">DNS setup</p>
						<p>
							Status:
							<strong class="status-{data.profile.customDomainStatus}">
								{data.profile.customDomainStatus}
							</strong>
						</p>
						<ol>
							<li>
								CNAME <code>{data.profile.customDomain}</code> →
								<code>{data.urls.cnameTarget}</code>
							</li>
							<li>
								TXT <code>_sndbnk-verify.{data.profile.customDomain}</code> →
								<code>{data.profile.domainVerifyToken}</code>
							</li>
						</ol>
						<p class="hint">
							DNS can take a few minutes. After both records propagate, verify below.
						</p>
						<div class="dns-actions">
							<form method="POST" action="?/verifyDomain" use:enhance={busyHandler('domain')}>
								<button class="pressable" type="submit" disabled={domainBusy}>
									{domainBusy ? 'Checking…' : 'Verify DNS'}
								</button>
							</form>
							<form method="POST" action="?/removeDomain" use:enhance={busyHandler('domain')}>
								<button class="pressable ghost danger" type="submit" disabled={domainBusy}>
									Remove domain
								</button>
							</form>
						</div>
					</div>
				{/if}
			{:else}
				<div class="locked">
					<p>
						Premium unlocks <span class="mono">{data.profile.username}.{data.baseDomain}</span> and CNAME
						custom domains.
					</p>
					<form method="POST" action="?/setPlan" use:enhance={busyHandler('plan')}>
						<input type="hidden" name="plan" value="premium" />
						<button class="pressable" type="submit" disabled={planBusy}>Switch to Premium</button>
					</form>
				</div>
			{/if}
		</section>

		<section class="block" aria-labelledby="storage-heading">
			<div class="block-head">
				<p class="eyebrow">04</p>
				<h2 id="storage-heading">Storage</h2>
				<p>
					Choose where new track uploads are stored. Local is the default; SSH lets you bring your
					own server.
				</p>
			</div>

			{#if form?.storageMessage && !storageBusy}
				<div class="banner error" role="alert">{form.storageMessage}</div>
			{/if}
			{#if form?.storageSuccess && !storageBusy}
				<div class="banner ok" role="status">{form.storageSuccess}</div>
			{/if}

			<form method="POST" action="?/saveStorage" use:enhance={busyHandler('storage')}>
				<fieldset class="adapter-list">
					<legend class="visually-hidden">Storage adapter</legend>
					{#each data.storageAdapters as adapter (adapter.id)}
						<label class="adapter-option" class:disabled={!adapter.enabled}>
							<input
								type="radio"
								name="adapter"
								value={adapter.id}
								checked={selectedAdapter === adapter.id}
								onchange={() => (userAdapter = adapter.id)}
								disabled={!adapter.enabled || storageBusy}
							/>
							<span class="adapter-copy">
								<span class="adapter-label">
									{adapter.label}
									{#if !adapter.enabled}
										<span class="coming-soon">Coming soon</span>
									{/if}
								</span>
								<span class="adapter-desc">{adapter.description}</span>
							</span>
						</label>
					{/each}
				</fieldset>

				{#if isSshAdapter}
					<label for="sshHost">SSH host</label>
					<input
						id="sshHost"
						name="sshHost"
						type="text"
						value={sshHostValue}
						placeholder="files.example.com"
						autocapitalize="none"
						spellcheck="false"
						required
					/>

					<label for="sshPort">SSH port</label>
					<input
						id="sshPort"
						name="sshPort"
						type="number"
						value={sshPortValue}
						min="1"
						max="65535"
						required
					/>

					<label for="sshUsername">SSH username</label>
					<input
						id="sshUsername"
						name="sshUsername"
						type="text"
						value={sshUsernameValue}
						autocapitalize="none"
						spellcheck="false"
						required
					/>

					<label for="sshRemotePath">Remote path</label>
					<input
						id="sshRemotePath"
						name="sshRemotePath"
						type="text"
						value={sshRemotePathValue}
						placeholder="/var/www/uploads"
						autocapitalize="none"
						spellcheck="false"
						required
					/>
					<p class="hint">Absolute directory on the server where files are written.</p>

					<label for="sshPrivateKey">SSH private key</label>
					<textarea
						id="sshPrivateKey"
						name="sshPrivateKey"
						rows="6"
						placeholder={data.storage.hasPrivateKey
							? 'Leave blank to keep existing key'
							: 'Paste your PEM private key'}
						spellcheck="false"
						autocapitalize="none"></textarea>

					<label for="sshPassphrase">Key passphrase</label>
					<input id="sshPassphrase" name="sshPassphrase" type="password" autocomplete="off" />
					<p class="hint">Optional. Only needed if your private key is encrypted.</p>

					{#if data.storage.hasPassphrase}
						<label class="checkbox-row">
							<input type="checkbox" name="clearPassphrase" value="on" />
							Clear stored passphrase
						</label>
					{/if}
				{/if}

				<div class="storage-actions">
					<button class="pressable" type="submit" disabled={storageBusy}>
						{storageBusy ? 'Saving…' : 'Save storage'}
					</button>
				</div>
			</form>

			<form
				class="test-storage-form"
				method="POST"
				action="?/testStorage"
				use:enhance={busyHandler('storage')}
			>
				<input type="hidden" name="adapter" value={selectedAdapter} />
				<button class="pressable ghost" type="submit" disabled={storageBusy}>
					{storageBusy ? 'Testing…' : 'Test connection'}
				</button>
			</form>
		</section>
	</main>
</div>

<style>
	.settings-page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 4rem;
	}

	main {
		width: min(100%, var(--site-content-max));
		margin: 0 auto;
		padding-top: clamp(1.25rem, 4vw, 2.5rem);
	}

	main > .eyebrow {
		margin: 0 0 0.75rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(3.2rem, 9vw, 5.5rem);
		line-height: 0.92;
		animation: rise 0.65s ease both;
	}

	.intro {
		max-width: 34rem;
		margin: 1rem 0 0;
		color: var(--muted);
		line-height: 1.5;
		animation: rise 0.75s ease 0.05s both;
	}

	.block {
		margin-top: clamp(2.75rem, 7vw, 4rem);
		padding-top: clamp(1.75rem, 4vw, 2.25rem);
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		animation: rise 0.8s ease both;
	}

	.block-head h2 {
		margin: 0.35rem 0 0.5rem;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(2rem, 5vw, 2.75rem);
		font-weight: 400;
		letter-spacing: -0.03em;
	}

	.block-head p:last-child {
		margin: 0;
		color: var(--muted);
		line-height: 1.5;
	}

	.plan-pill {
		display: inline-block;
		margin-left: 0.15rem;
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	form {
		display: grid;
		margin-top: 1.5rem;
	}

	label {
		margin: 0 0 0.5rem;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	input {
		width: 100%;
		height: 3.1rem;
		margin-bottom: 0.35rem;
		padding: 0 0.85rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		color: var(--ink);
		background: transparent;
		outline: none;
	}

	input:focus {
		box-shadow: 4px 4px 0 var(--accent);
	}

	input:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	textarea {
		width: 100%;
		min-height: 8rem;
		margin-bottom: 0.35rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		color: var(--ink);
		background: transparent;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.82rem;
		line-height: 1.45;
		resize: vertical;
		outline: none;
	}

	textarea:focus {
		box-shadow: 4px 4px 0 var(--accent);
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

	.adapter-list {
		margin: 1.5rem 0 0;
		padding: 0;
		border: none;
	}

	.adapter-option {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.75rem;
		align-items: start;
		margin-bottom: 0.75rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--ink);
		cursor: pointer;
	}

	.adapter-option.disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.adapter-option input[type='radio'] {
		width: auto;
		height: auto;
		margin: 0.2rem 0 0;
		accent-color: var(--ink);
	}

	.adapter-copy {
		display: grid;
		gap: 0.25rem;
	}

	.adapter-label {
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.coming-soon {
		margin-left: 0.35rem;
		padding: 0.05rem 0.35rem;
		border: 1px solid var(--ink);
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		vertical-align: middle;
	}

	.adapter-desc {
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.checkbox-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1rem;
		font-size: 0.82rem;
		font-weight: 600;
		text-transform: none;
		letter-spacing: normal;
		cursor: pointer;
	}

	.checkbox-row input[type='checkbox'] {
		width: auto;
		height: auto;
		margin: 0;
	}

	.storage-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.35rem;
	}

	.test-storage-form {
		margin: 0;
		margin-top: 0.75rem;
	}

	.hint {
		margin: 0 0 1.15rem;
		color: var(--muted);
		font-size: 0.72rem;
		line-height: 1.45;
	}

	button.pressable,
	.pressable {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		min-height: 3.1rem;
		margin-top: 0.35rem;
		padding: 0 1.1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--ink);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.pressable:disabled {
		opacity: 0.55;
		box-shadow: 2px 2px 0 var(--ink);
		cursor: not-allowed;
	}

	.pressable.ghost {
		background: transparent;
	}

	.pressable.danger {
		background: transparent;
	}

	.banner {
		margin-top: 1.25rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--ink);
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1.4;
	}

	.banner.error {
		background: rgb(200 255 61 / 25%);
	}

	.banner.ok {
		color: var(--on-accent);
		background: var(--accent);
	}

	.plan-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.25rem;
		margin-top: 1.5rem;
	}

	.plan {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.25rem 1.25rem 1.35rem;
		border: 1px solid var(--ink);
		background: transparent;
	}

	.plan.active {
		background: rgb(200 255 61 / 22%);
		box-shadow: 6px 6px 0 var(--ink);
	}

	.plan h3 {
		margin: 0;
		font-size: 1.8rem;
		line-height: 1;
	}

	.plan-summary {
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.plan ul {
		flex: 1;
		margin: 0.25rem 0 0.5rem;
		padding: 0 0 0 1.1rem;
		color: var(--ink);
		font-size: 0.85rem;
		line-height: 1.45;
	}

	.plan form {
		margin-top: auto;
	}

	.plan button {
		width: 100%;
	}

	.domain-panel {
		display: grid;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}

	.url-row {
		display: grid;
		grid-template-columns: 7rem 1fr;
		gap: 0.75rem;
		align-items: baseline;
		padding: 0.7rem 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
	}

	.url-row:last-child {
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
	}

	.url-label {
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.url-row a {
		color: var(--ink);
		font-weight: 700;
		word-break: break-all;
	}

	.dns-box {
		margin-top: 1.75rem;
		padding: 1.25rem;
		border: 1px solid var(--ink);
		background: color-mix(in srgb, var(--ink) 3%, transparent);
	}

	.dns-box ol {
		margin: 0.75rem 0;
		padding-left: 1.2rem;
		font-size: 0.9rem;
		line-height: 1.55;
	}

	.dns-box code {
		padding: 0.1rem 0.3rem;
		background: var(--paper);
		border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
		font-size: 0.8rem;
		word-break: break-all;
	}

	.status-pending {
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.status-active {
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--on-accent);
		background: var(--accent);
		padding: 0.05rem 0.35rem;
	}

	.status-none {
		text-transform: uppercase;
	}

	.dns-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.dns-actions form {
		margin: 0;
	}

	.locked {
		margin-top: 1.5rem;
		padding: 1.25rem;
		border: 1px dashed var(--ink);
	}

	.locked p {
		margin: 0 0 1rem;
		color: var(--muted);
		line-height: 1.5;
	}

	.mono {
		color: var(--ink);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-weight: 700;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.6rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 720px) {
		.plan-grid {
			grid-template-columns: 1fr;
		}

		.url-row {
			grid-template-columns: 1fr;
			gap: 0.2rem;
		}
	}
</style>
