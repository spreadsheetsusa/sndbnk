<script>
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { PUBLIC_BASE_DOMAIN } from '$app/env/public';
	import Avatar from '#lib/components/Avatar.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import ProfileLinksEditor from '#lib/components/settings/ProfileLinksEditor.svelte';

	let { data, form } = $props();

	const tabs = [
		{ id: 'profile', label: 'Profile' },
		{ id: 'billing', label: 'Billing' },
		{ id: 'domain', label: 'Domain' },
		{ id: 'storage', label: 'Storage' }
	];

	/**
	 * Form actions carry `&tab=`, so submitting without JS lands back on the section
	 * whose banner is about to be shown.
	 */
	function tabFromUrl() {
		const requested = page.url.searchParams.get('tab');
		return tabs.find((tab) => tab.id === requested)?.id ?? 'profile';
	}

	let activeTab = $state(tabFromUrl());

	/**
	 * @param {string} id
	 */
	function selectTab(id) {
		activeTab = id;

		const url = new URL(page.url);
		url.searchParams.set('tab', id);
		replaceState(url, page.state);
	}

	/**
	 * @param {KeyboardEvent & { currentTarget: HTMLButtonElement }} event
	 */
	function handleTabKeydown(event) {
		const current = tabs.findIndex((tab) => tab.id === activeTab);

		let next = -1;
		if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
		if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
		if (event.key === 'Home') next = 0;
		if (event.key === 'End') next = tabs.length - 1;
		if (next === -1) return;

		event.preventDefault();
		selectTab(tabs[next].id);

		const sibling = event.currentTarget.parentElement?.children[next];
		if (sibling instanceof HTMLElement) {
			sibling.focus();
		}
	}

	let profileBusy = $state(false);
	let emailBusy = $state(false);
	let billingBusy = $state(false);
	let domainBusy = $state(false);
	let storageBusy = $state(false);
	let avatarBusy = $state(false);

	/** @type {string | null} */
	let userAdapter = $state(null);

	const canHost = $derived(data.billing.allowSubdomain || data.billing.allowCustomDomain);
	const nameValue = $derived(form?.name ?? data.user.name);
	const usernameValue = $derived(form?.username ?? data.profile.username);
	const bioValue = $derived(form?.bio ?? data.profile.bio);
	/** Null until the field is touched, so the counter starts from the loaded value. */
	let bioTyped = $state(/** @type {number | null} */ (null));
	const bioLength = $derived(bioTyped ?? bioValue.length);
	const locationValue = $derived(form?.location ?? data.profile.location);
	const newEmailValue = $derived(form?.newEmail ?? '');
	const emailJustUpdated = $derived(page.url.searchParams.get('emailUpdated') === '1');
	const linkRows = $derived(form?.links ?? data.links);
	// Remount the editor whenever the server-side set changes, so its row state reseeds.
	const linksKey = $derived(JSON.stringify(linkRows));
	const domainValue = $derived(form?.customDomain ?? data.profile.customDomain ?? '');
	const selectedAdapter = $derived(userAdapter ?? form?.adapter ?? data.storage.adapter);
	const sshHostValue = $derived(form?.sshHost ?? data.storage.sshHost);
	const sshPortValue = $derived(form?.sshPort ?? String(data.storage.sshPort ?? 22));
	const sshUsernameValue = $derived(form?.sshUsername ?? data.storage.sshUsername);
	const sshRemotePathValue = $derived(form?.sshRemotePath ?? data.storage.sshRemotePath);
	const isSshAdapter = $derived(selectedAdapter === 'ssh');

	/**
	 * @param {'profile' | 'email' | 'billing' | 'domain' | 'storage' | 'avatar'} which
	 */
	function busyHandler(which) {
		return () => {
			if (which === 'profile') profileBusy = true;
			if (which === 'email') emailBusy = true;
			if (which === 'billing') billingBusy = true;
			if (which === 'domain') domainBusy = true;
			if (which === 'storage') storageBusy = true;
			if (which === 'avatar') avatarBusy = true;

			return async ({ update }) => {
				try {
					await update();
				} finally {
					if (which === 'profile') profileBusy = false;
					if (which === 'email') emailBusy = false;
					if (which === 'billing') billingBusy = false;
					if (which === 'domain') domainBusy = false;
					if (which === 'storage') storageBusy = false;
					if (which === 'avatar') avatarBusy = false;
				}
			};
		};
	}

	/**
	 * @param {number} cents
	 */
	function money(cents) {
		const dollars = cents / 100;
		return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
	}

	/**
	 * @param {number} bytes
	 */
	function bytes(value) {
		if (value < 1024) return `${value} B`;
		const units = ['KB', 'MB', 'GB', 'TB'];
		let scaled = value / 1024;
		let unit = 0;
		while (scaled >= 1024 && unit < units.length - 1) {
			scaled /= 1024;
			unit += 1;
		}
		return `${scaled >= 10 ? Math.round(scaled) : scaled.toFixed(1)} ${units[unit]}`;
	}

	/**
	 * @param {number} used
	 * @param {number | null} cap
	 */
	function fillPercent(used, cap) {
		if (!cap) return 0;
		return Math.min(100, Math.round((used / cap) * 100));
	}

	/** @type {Record<string, string>} */
	const STATUS_COPY = {
		active: 'Active',
		trialing: 'Trialing',
		past_due: 'Payment failed — retrying',
		unpaid: 'Unpaid',
		canceled: 'Canceled',
		incomplete: 'Awaiting payment',
		incomplete_expired: 'Checkout expired',
		paused: 'Paused',
		grandfathered: 'Complimentary'
	};

	const statusLabel = $derived(
		data.billing.status
			? (STATUS_COPY[data.billing.status] ?? data.billing.status)
			: 'No subscription'
	);

	const renewsOn = $derived(
		data.billing.currentPeriodEnd
			? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
					new Date(data.billing.currentPeriodEnd)
				)
			: null
	);

	/**
	 * @param {Event & { currentTarget: HTMLInputElement }} event
	 */
	function submitOnPick(event) {
		if (event.currentTarget.files?.length) {
			event.currentTarget.form?.requestSubmit();
		}
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
		<header class="page-head">
			<p class="eyebrow eyebrow-chip accent-text">Account</p>
			<h1 class="display-face">Settings</h1>
			<p class="intro">Your identity, plan, and where the world finds you.</p>
		</header>

		<div class="tab-bar" role="tablist" aria-label="Settings sections">
			{#each tabs as tab (tab.id)}
				<button
					type="button"
					role="tab"
					id="tab-{tab.id}"
					class="tab"
					class:active={activeTab === tab.id}
					aria-selected={activeTab === tab.id}
					aria-controls="panel-{tab.id}"
					tabindex={activeTab === tab.id ? 0 : -1}
					onclick={() => selectTab(tab.id)}
					onkeydown={handleTabKeydown}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		{#if activeTab === 'profile'}
			<div class="block" role="tabpanel" id="panel-profile" aria-labelledby="tab-profile">
				<div class="block-head">
					<h2>Profile</h2>
					<p>How you appear across SNDBNK. Email stays your sign-in.</p>
				</div>

				{#if form?.avatarMessage && !avatarBusy}
					<div class="banner error" role="alert">{form.avatarMessage}</div>
				{/if}
				{#if form?.avatarSuccess && !avatarBusy}
					<div class="banner ok" role="status">{form.avatarSuccess}</div>
				{/if}

				<div class="avatar-block">
					<Avatar src={data.user.image} name={data.user.name} size="5rem" />
					<div class="avatar-copy">
						<p class="avatar-title">Avatar</p>
						<p class="hint">
							Square works best. JPG, PNG, or WebP up to 2MB. Shown in the header, on your profile,
							and next to your comments.
						</p>
						<div class="avatar-actions">
							<form
								class="inline-form"
								method="POST"
								action="?/uploadAvatar&tab=profile"
								enctype="multipart/form-data"
								use:enhance={busyHandler('avatar')}
							>
								<label class="file-btn" for="avatar">
									{avatarBusy ? 'Uploading…' : data.user.image ? 'Replace' : 'Upload'}
								</label>
								<input
									id="avatar"
									class="visually-hidden"
									name="avatar"
									type="file"
									accept="image/jpeg,image/png,image/webp"
									disabled={avatarBusy}
									onchange={submitOnPick}
								/>
							</form>

							{#if data.user.image}
								<form
									class="inline-form"
									method="POST"
									action="?/removeAvatar&tab=profile"
									use:enhance={busyHandler('avatar')}
								>
									<button class="text-btn" type="submit" disabled={avatarBusy}>Remove</button>
								</form>
							{/if}
						</div>
					</div>
				</div>

				{#if form?.profileMessage && !profileBusy}
					<div class="banner error" role="alert">{form.profileMessage}</div>
				{/if}
				{#if form?.profileSuccess && !profileBusy}
					<div class="banner ok" role="status">{form.profileSuccess}</div>
				{/if}

				<form
					method="POST"
					action="?/updateProfile&tab=profile"
					use:enhance={busyHandler('profile')}
				>
					<label for="name">Display name</label>
					<input
						id="name"
						class="field-md"
						name="name"
						type="text"
						value={nameValue}
						autocomplete="name"
						required
					/>

					<label for="username">Username</label>
					<input
						id="username"
						class="field-md"
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

					<label for="bio">Bio</label>
					<textarea
						id="bio"
						class="bio field-full"
						name="bio"
						rows="4"
						maxlength={data.limits.bio}
						placeholder="What you make, where you're headed."
						value={bioValue}
						oninput={(event) => (bioTyped = event.currentTarget.value.length)}></textarea>
					<p class="hint" aria-live="polite">{bioLength} / {data.limits.bio} characters</p>

					<label for="location">Location</label>
					<input
						id="location"
						class="field-sm"
						name="location"
						type="text"
						value={locationValue}
						maxlength={data.limits.location}
						placeholder="Berlin, DE"
						autocomplete="address-level2"
					/>
					<p class="hint">Optional. Shown under your name on your public profile.</p>

					{#key linksKey}
						<ProfileLinksEditor initialLinks={linkRows} />
					{/key}

					<button class="pressable" type="submit" disabled={profileBusy}>
						{profileBusy ? 'Saving…' : 'Save profile'}
					</button>
				</form>

				<div class="email-section" aria-labelledby="email-heading">
					<h3 id="email-heading">Sign-in email</h3>
					<p class="hint">
						Current address: <strong>{data.user.email}</strong>. We send a link to the new address;
						it becomes your sign-in email only after you confirm.
					</p>

					{#if emailJustUpdated && !form?.emailMessage && !form?.emailSuccess && !emailBusy}
						<div class="banner ok" role="status">Your sign-in email is updated.</div>
					{/if}
					{#if form?.emailMessage && !emailBusy}
						<div class="banner error" role="alert" id="email-error">{form.emailMessage}</div>
					{/if}
					{#if form?.emailSuccess && !emailBusy}
						<div class="banner ok" role="status">{form.emailSuccess}</div>
					{/if}

					<form
						method="POST"
						action="?/changeEmail&tab=profile"
						use:enhance={busyHandler('email')}
						aria-busy={emailBusy}
						aria-describedby={form?.emailMessage && !emailBusy ? 'email-error' : undefined}
					>
						<label for="newEmail">New email</label>
						<input
							id="newEmail"
							class="field-lg"
							name="newEmail"
							type="email"
							value={newEmailValue}
							autocomplete="email"
							required
							aria-invalid={form?.emailMessage && !emailBusy ? 'true' : undefined}
						/>

						<label for="confirmEmail">Confirm new email</label>
						<input
							id="confirmEmail"
							class="field-lg"
							name="confirmEmail"
							type="email"
							value={newEmailValue}
							autocomplete="email"
							required
						/>

						<label for="emailPassword">Current password</label>
						<input
							id="emailPassword"
							class="field-md"
							name="password"
							type="password"
							autocomplete="current-password"
							required
						/>

						<button class="pressable" type="submit" disabled={emailBusy}>
							{emailBusy ? 'Sending…' : 'Send confirmation'}
						</button>
					</form>
				</div>
			</div>
		{/if}

		{#if activeTab === 'billing'}
			<div class="block" role="tabpanel" id="panel-billing" aria-labelledby="tab-billing">
				<div class="block-head">
					<h2>Billing</h2>
					<p>Your plan, what you are using, and where to change your card.</p>
				</div>

				{#if form?.billingMessage && !billingBusy}
					<div class="banner error" role="alert">{form.billingMessage}</div>
				{/if}
				{#if form?.billingSuccess && !billingBusy}
					<div class="banner ok" role="status">{form.billingSuccess}</div>
				{/if}

				<div class="current-plan">
					<div class="current-head">
						<div>
							<p class="eyebrow">Current plan</p>
							<h3 class="display-face">{data.billing.planLabel}</h3>
							<p class="plan-summary">{data.billing.planBlurb}</p>
						</div>
						<div class="current-meta">
							<p class="status status-{data.billing.status ?? 'none'}">{statusLabel}</p>
							{#if data.billing.interval}
								<p class="hint">
									{money(
										data.billing.interval === 'year'
											? data.billing.yearlyAmount
											: data.billing.monthlyAmount
									)} / {data.billing.interval === 'year' ? 'year' : 'month'}
								</p>
							{/if}
							{#if renewsOn}
								<p class="hint">
									{data.billing.cancelAtPeriodEnd ? 'Ends' : 'Renews'}
									{renewsOn}
								</p>
							{/if}
						</div>
					</div>

					{#if data.billing.cancelAtPeriodEnd}
						<p class="notice" role="status">
							Your subscription is set to end on {renewsOn}. You keep every feature until then.
						</p>
					{/if}
				</div>

				<div class="usage" aria-label="Usage">
					<div class="meter">
						<div class="meter-head">
							<span class="meter-label">Tracks</span>
							<span class="meter-value">
								{data.usage.trackCount}
								{#if data.usage.maxTracks !== null}/ {data.usage.maxTracks}{:else}
									/ unlimited
								{/if}
							</span>
						</div>
						{#if data.usage.maxTracks !== null}
							<div
								class="meter-track"
								role="progressbar"
								aria-valuenow={data.usage.trackCount}
								aria-valuemin="0"
								aria-valuemax={data.usage.maxTracks}
								aria-label="Tracks used"
							>
								<span
									class="meter-fill"
									style="width: {fillPercent(data.usage.trackCount, data.usage.maxTracks)}%"
								></span>
							</div>
						{/if}
					</div>

					<div class="meter">
						<div class="meter-head">
							<span class="meter-label">Hosted storage</span>
							<span class="meter-value">
								{bytes(data.usage.localBytes)}
								{#if data.usage.maxLocalBytes !== null}
									/ {bytes(data.usage.maxLocalBytes)}
								{:else}
									/ unlimited
								{/if}
							</span>
						</div>
						{#if data.usage.maxLocalBytes !== null}
							<div
								class="meter-track"
								role="progressbar"
								aria-valuenow={data.usage.localBytes}
								aria-valuemin="0"
								aria-valuemax={data.usage.maxLocalBytes}
								aria-label="Hosted storage used"
							>
								<span
									class="meter-fill"
									style="width: {fillPercent(data.usage.localBytes, data.usage.maxLocalBytes)}%"
								></span>
							</div>
						{/if}
						<p class="hint">
							Only counts uploads on SNDBNK's storage — your own server is uncounted.
						</p>
					</div>
				</div>

				{#if !data.billing.enabled}
					<div class="banner error" role="alert">
						Billing is not configured on this server, so plans cannot be changed here.
					</div>
				{:else if data.billing.hasSubscription}
					<div class="billing-actions">
						<form method="POST" action="?/openPortal&tab=billing">
							<button class="pressable" type="submit"
								>Manage card, invoices, and cancellation</button
							>
						</form>
						<p class="hint">Opens Stripe's billing portal. Changes come back here automatically.</p>
					</div>

					<div class="switch-grid">
						{#each data.plans.filter((option) => option.purchasable) as option (option.id)}
							{#each ['month', 'year'] as interval (interval)}
								{@const amount = interval === 'year' ? option.yearlyAmount : option.monthlyAmount}
								{@const isCurrent =
									option.id === data.billing.planId && interval === data.billing.interval}
								{#if !isCurrent}
									<form
										method="POST"
										action="?/changePlan&tab=billing"
										use:enhance={busyHandler('billing')}
									>
										<input type="hidden" name="plan" value={option.id} />
										<input type="hidden" name="interval" value={interval} />
										<button class="pressable ghost" type="submit" disabled={billingBusy}>
											Switch to {option.label} · {money(amount)}/{interval === 'year' ? 'yr' : 'mo'}
										</button>
									</form>
								{/if}
							{/each}
						{/each}
					</div>
				{:else}
					<div class="billing-actions">
						<a class="cta pressable" href="/plans">See plans and upgrade</a>
						<p class="hint">
							{data.billing.status === 'grandfathered'
								? 'Your plan is complimentary — no card on file and nothing to pay.'
								: 'Paid plans unlock your own subdomain, custom domains, and bring-your-own storage.'}
						</p>
					</div>
				{/if}
			</div>
		{/if}

		{#if activeTab === 'domain'}
			<div class="block" role="tabpanel" id="panel-domain" aria-labelledby="tab-domain">
				<div class="block-head">
					<h2>Domain</h2>
					<p>
						{#if canHost}
							Your subdomain is live. Optionally connect a custom domain with a CNAME.
						{:else}
							Upgrade to unlock <strong>{data.profile.username}.{data.baseDomain}</strong>
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

				{#if canHost}
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
						action="?/saveDomain&tab=domain"
						use:enhance={busyHandler('domain')}
					>
						<label for="customDomain">Custom domain</label>
						<input
							id="customDomain"
							class="field-lg"
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
								<form
									method="POST"
									action="?/verifyDomain&tab=domain"
									use:enhance={busyHandler('domain')}
								>
									<button class="pressable" type="submit" disabled={domainBusy}>
										{domainBusy ? 'Checking…' : 'Verify DNS'}
									</button>
								</form>
								<form
									method="POST"
									action="?/removeDomain&tab=domain"
									use:enhance={busyHandler('domain')}
								>
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
							Premium and Business unlock
							<span class="mono">{data.profile.username}.{data.baseDomain}</span> plus CNAME custom domains.
						</p>
						<a class="cta pressable" href="/plans">See plans</a>
					</div>
				{/if}
			</div>
		{/if}

		{#if activeTab === 'storage'}
			<div class="block" role="tabpanel" id="panel-storage" aria-labelledby="tab-storage">
				<div class="block-head">
					<h2>Storage</h2>
					<p>
						Choose where new track uploads are stored. Local is the default; SSH lets you bring your
						own server.
					</p>
				</div>

				{#if !data.billing.allowStorageAdapters}
					<div class="locked">
						<p>
							Bringing your own storage needs Premium or Business. On {data.billing.planLabel} your uploads
							stay on SNDBNK.
						</p>
						<a class="cta pressable" href="/plans">See plans</a>
					</div>
				{/if}

				{#if form?.storageMessage && !storageBusy}
					<div class="banner error" role="alert">{form.storageMessage}</div>
				{/if}
				{#if form?.storageSuccess && !storageBusy}
					<div class="banner ok" role="status">{form.storageSuccess}</div>
				{/if}

				<form method="POST" action="?/saveStorage&tab=storage" use:enhance={busyHandler('storage')}>
					<fieldset class="adapter-list">
						<legend class="visually-hidden">Storage adapter</legend>
						{#each data.storageAdapters as adapter (adapter.id)}
							{@const needsUpgrade = adapter.id !== 'local' && !data.billing.allowStorageAdapters}
							<label class="adapter-option" class:disabled={!adapter.enabled || needsUpgrade}>
								<input
									type="radio"
									name="adapter"
									value={adapter.id}
									checked={selectedAdapter === adapter.id}
									onchange={() => (userAdapter = adapter.id)}
									disabled={!adapter.enabled || needsUpgrade || storageBusy}
								/>
								<span class="adapter-copy">
									<span class="adapter-label">
										{adapter.label}
										{#if !adapter.enabled}
											<span class="coming-soon">Coming soon</span>
										{:else if needsUpgrade}
											<span class="coming-soon">Premium</span>
										{/if}
									</span>
									<span class="adapter-desc">{adapter.description}</span>
								</span>
							</label>
						{/each}
					</fieldset>

					{#if isSshAdapter}
						<div class="field-row">
							<div class="field-cell">
								<label for="sshHost">SSH host</label>
								<input
									id="sshHost"
									class="field-md"
									name="sshHost"
									type="text"
									value={sshHostValue}
									placeholder="files.example.com"
									autocapitalize="none"
									spellcheck="false"
									required
								/>
							</div>
							<div class="field-cell field-cell-xs">
								<label for="sshPort">SSH port</label>
								<input
									id="sshPort"
									class="field-xs"
									name="sshPort"
									type="number"
									value={sshPortValue}
									min="1"
									max="65535"
									required
								/>
							</div>
						</div>

						<label for="sshUsername">SSH username</label>
						<input
							id="sshUsername"
							class="field-md"
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
							class="field-full"
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
							class="field-full"
							name="sshPrivateKey"
							rows="6"
							placeholder={data.storage.hasPrivateKey
								? 'Leave blank to keep existing key'
								: 'Paste your PEM private key'}
							spellcheck="false"
							autocapitalize="none"></textarea>

						<label for="sshPassphrase">Key passphrase</label>
						<input
							id="sshPassphrase"
							class="field-md"
							name="sshPassphrase"
							type="password"
							autocomplete="off"
						/>
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
					action="?/testStorage&tab=storage"
					use:enhance={busyHandler('storage')}
				>
					<input type="hidden" name="adapter" value={selectedAdapter} />
					<button class="pressable ghost" type="submit" disabled={storageBusy}>
						{storageBusy ? 'Testing…' : 'Test connection'}
					</button>
				</form>
			</div>
		{/if}
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
		padding-top: clamp(0.75rem, 2vw, 1.25rem);
	}

	.page-head {
		margin-bottom: 2.5rem;
	}

	.page-head > .eyebrow {
		margin: 0 0 0.35rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.4rem, 6vw, 3.75rem);
		line-height: 0.95;
		animation: rise 0.65s ease both;
	}

	.intro {
		max-width: 34rem;
		margin: 0.4rem 0 0;
		color: var(--muted);
		line-height: 1.4;
		animation: rise 0.75s ease 0.05s both;
	}

	.tab-bar {
		display: flex;
		gap: clamp(1.15rem, 3.5vw, 2.25rem);
		margin-top: 0;
		padding-top: 0.25rem;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
		animation: rise 0.75s ease 0.1s both;
	}

	.tab-bar::-webkit-scrollbar {
		display: none;
	}

	.tab {
		position: relative;
		padding: 0 0 0.85rem;
		border: 0;
		color: var(--muted);
		background: transparent;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
		scroll-snap-align: start;
		cursor: pointer;
		transition: color 120ms ease;
	}

	.tab:hover,
	.tab.active {
		color: var(--ink);
	}

	/* Sits on the panel's border-top so the active tab reads as connected to its section */
	.tab.active::after {
		position: absolute;
		right: 0;
		bottom: -1px;
		left: 0;
		height: 2px;
		background: var(--accent);
		content: '';
	}

	.block {
		padding-top: clamp(1.75rem, 4vw, 2.25rem);
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		animation: rise 0.8s ease both;
	}

	.block-head h2 {
		margin: 0.35rem 0 0.5rem;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: clamp(2rem, 5vw, 2.75rem);
		font-weight: 400;
		letter-spacing: -0.03em;
	}

	.block-head p:last-child {
		margin: 0;
		color: var(--muted);
		line-height: 1.5;
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

	input:not([type='checkbox']):not([type='radio']):not([type='file']):not([type='hidden']) {
		max-width: 100%;
		height: 3.1rem;
		margin-bottom: 0.35rem;
		padding: 0 0.85rem;
		border: 1px solid var(--field-border);
		border-radius: 0;
		color: var(--ink);
		background: var(--field-surface);
		outline: none;
	}

	input:not([type='checkbox']):not([type='radio']):not([type='file']):not([type='hidden']):focus {
		box-shadow: 4px 4px 0 var(--accent);
	}

	input:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	textarea {
		max-width: 100%;
		min-height: 8rem;
		margin-bottom: 0.35rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--field-border);
		border-radius: 0;
		color: var(--ink);
		background: var(--field-surface);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.82rem;
		line-height: 1.45;
		resize: vertical;
		outline: none;
	}

	textarea:focus {
		box-shadow: 4px 4px 0 var(--accent);
	}

	textarea.bio {
		min-height: 6rem;
		font-family: inherit;
		font-size: 0.95rem;
	}

	.field-xs {
		width: 5.5rem;
		max-width: min(5.5rem, 100%);
	}

	.field-sm {
		width: 15rem;
		max-width: min(15rem, 100%);
	}

	.field-md {
		width: 21rem;
		max-width: min(21rem, 100%);
	}

	.field-lg {
		width: 26rem;
		max-width: min(26rem, 100%);
	}

	.field-full {
		width: 100%;
		max-width: 100%;
	}

	.field-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		align-items: end;
		margin-bottom: 0;
	}

	.field-cell {
		display: grid;
		min-width: 0;
	}

	.field-cell label {
		margin-bottom: 0.5rem;
	}

	.field-cell input {
		margin-bottom: 0.35rem;
	}

	.field-cell-xs {
		flex: 0 0 auto;
	}

	.avatar-block {
		display: flex;
		gap: 1.15rem;
		align-items: flex-start;
		margin-top: 1.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.avatar-copy {
		min-width: 0;
	}

	.avatar-title {
		margin: 0 0 0.5rem;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.avatar-copy .hint {
		max-width: 34rem;
		margin-bottom: 0.85rem;
	}

	.avatar-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.inline-form {
		display: inline-flex;
		margin: 0;
	}

	.file-btn {
		display: inline-flex;
		align-items: center;
		margin: 0;
		padding: 0.55rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--ink);
		background: transparent;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.file-btn:hover {
		color: var(--on-accent);
		background: var(--accent);
	}

	.text-btn {
		padding: 0;
		border: 0;
		color: var(--muted);
		background: transparent;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-decoration: underline;
		text-transform: uppercase;
		text-underline-offset: 0.25rem;
		cursor: pointer;
	}

	.text-btn:hover:not(:disabled) {
		color: var(--ink);
	}

	.text-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
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

	.email-section {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.email-section h3 {
		margin: 0 0 0.5rem;
		font-size: 0.95rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.email-section form {
		margin-top: 1rem;
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
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.pressable:disabled {
		opacity: 0.55;
		box-shadow: 2px 2px 0 var(--hard-shadow);
		cursor: not-allowed;
	}

	.pressable.ghost,
	.pressable.danger {
		border-color: var(--hard-border);
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

	.current-plan {
		margin-top: 1.5rem;
		padding: 1.35rem;
		border: 1px solid var(--hard-border);
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		box-shadow: 6px 6px 0 var(--hard-shadow);
	}

	.current-head {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: flex-start;
		justify-content: space-between;
	}

	.current-head .eyebrow {
		margin: 0 0 0.4rem;
	}

	.current-head h3 {
		margin: 0;
		font-size: 1.8rem;
		line-height: 1;
	}

	.plan-summary {
		margin: 0.4rem 0 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.45;
	}

	.current-meta {
		text-align: right;
	}

	.current-meta .hint {
		margin: 0.3rem 0 0;
	}

	.status {
		display: inline-block;
		margin: 0;
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--ink);
		font-size: 0.65rem;
		font-weight: 900;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.status-active,
	.status-trialing,
	.status-grandfathered {
		color: var(--on-accent);
		background: var(--accent);
	}

	.notice {
		margin: 1.1rem 0 0;
		padding-top: 1rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1.45;
	}

	.usage {
		display: grid;
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.meter-head {
		display: flex;
		gap: 1rem;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.meter-label {
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.meter-value {
		color: var(--muted);
		font-size: 0.78rem;
	}

	.meter-track {
		height: 0.85rem;
		border: 1px solid var(--ink);
		background: transparent;
	}

	.meter-fill {
		display: block;
		height: 100%;
		background: var(--accent);
	}

	.meter .hint {
		margin: 0.5rem 0 0;
	}

	.billing-actions {
		margin-top: 2rem;
	}

	.billing-actions .hint {
		margin: 0.7rem 0 0;
	}

	.switch-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 0.75rem;
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.switch-grid button {
		width: 100%;
	}

	.cta {
		display: inline-block;
		padding: 0.8rem 1.15rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		text-decoration: none;
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

	@media (max-width: 640px) {
		.page-head {
			margin-bottom: 1.5rem;
		}

		.intro {
			display: none;
		}

		.current-meta {
			text-align: left;
		}

		.url-row {
			grid-template-columns: 1fr;
			gap: 0.2rem;
		}

		.field-xs,
		.field-sm,
		.field-md,
		.field-lg {
			width: 100%;
			max-width: 100%;
		}

		.field-row {
			flex-direction: column;
			align-items: stretch;
		}
	}

	@media (max-width: 560px) {
		.avatar-block {
			flex-direction: column;
			align-items: flex-start;
		}
	}

	@media (pointer: coarse) {
		.tab {
			min-height: var(--tap-min);
		}
	}
</style>
