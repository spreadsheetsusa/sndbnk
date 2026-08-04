<script>
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { PUBLIC_BASE_DOMAIN } from '$app/env/public';
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';
	import Avatar from '#lib/components/Avatar.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import ProfileLinksEditor from '#lib/components/settings/ProfileLinksEditor.svelte';

	let { data, form } = $props();

	const tabs = [
		{ id: 'profile', label: 'Profile' },
		{ id: 'billing', label: 'Billing' },
		{ id: 'domain', label: 'Domain' },
		{ id: 'site', label: 'Site' },
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
	let siteBusy = $state(false);
	let logoBusy = $state(false);
	let ogBusy = $state(false);
	let storageBusy = $state(false);
	let avatarBusy = $state(false);

	/** @type {string | null} */
	let userAdapter = $state(null);

	const canSubdomain = $derived(data.billing.allowSubdomain);
	const canCustomDomain = $derived(data.billing.allowCustomDomain);
	const canEditSite = $derived(data.billing.canEditSite);
	const canRemoveBranding = $derived(data.billing.allowRemoveBranding);
	const nameValue = $derived(form?.name ?? data.user.name);
	const usernameValue = $derived(form?.username ?? data.profile.username);
	const bioValue = $derived(form?.bio ?? data.profile.bio);
	/** Null until the field is touched, so the counter starts from the loaded value. */
	let bioTyped = $state(/** @type {number | null} */ (null));
	const bioLength = $derived(bioTyped ?? bioValue.length);
	const locationValue = $derived(form?.location ?? data.profile.location);
	const newEmailValue = $derived(form?.newEmail ?? '');
	const emailJustUpdated = $derived(page.url.searchParams.get('emailUpdated') === '1');
	const emailBannerActive = $derived(
		emailJustUpdated || Boolean(form?.emailMessage) || Boolean(form?.emailSuccess)
	);
	let emailUserOpen = $state(false);
	let emailUserClosed = $state(false);
	const emailOpen = $derived(emailUserOpen || (emailBannerActive && !emailUserClosed));

	function toggleEmailOpen() {
		if (emailOpen) {
			emailUserOpen = false;
			emailUserClosed = true;
		} else {
			emailUserOpen = true;
			emailUserClosed = false;
		}
	}

	const linkRows = $derived(form?.links ?? data.links);
	// Remount the editor whenever the server-side set changes, so its row state reseeds.
	const linksKey = $derived(JSON.stringify(linkRows));
	const domainValue = $derived(form?.customDomain ?? data.profile.customDomain ?? '');
	const platformAddresses = $derived(data.domainDns?.platformAddresses ?? []);
	const dnsIsApex = $derived(Boolean(data.domainDns?.apexDomain));

	/** @type {Record<string, string>} */
	const DOMAIN_STATUS_COPY = {
		active: 'Live',
		pending: 'Pending',
		none: 'Not set'
	};

	const domainStatusLabel = $derived(
		DOMAIN_STATUS_COPY[data.profile.customDomainStatus] ?? data.profile.customDomainStatus
	);

	const dnsRecords = $derived.by(() => {
		const domain = data.profile.customDomain;
		const token = data.profile.domainVerifyToken;
		if (!domain || !token) return [];

		/** @type {{ type: string, host: string, values: string[] }[]} */
		const rows = [
			{
				type: 'TXT',
				host: `_sndbnk-verify.${domain}`,
				values: [token]
			}
		];

		if (dnsIsApex) {
			rows.push({
				type: 'A',
				host: '@',
				values:
					platformAddresses.length > 0 ? platformAddresses : [`Same IPs as ${data.baseDomain}`]
			});
		} else {
			rows.push({
				type: 'CNAME',
				host: domain,
				values: [data.urls.cnameTarget]
			});
		}

		return rows;
	});

	const selectedAdapter = $derived(userAdapter ?? form?.adapter ?? data.storage.adapter);
	const sshHostValue = $derived(form?.sshHost ?? data.storage.sshHost);
	const sshPortValue = $derived(form?.sshPort ?? String(data.storage.sshPort ?? 22));
	const sshUsernameValue = $derived(form?.sshUsername ?? data.storage.sshUsername);
	const sshRemotePathValue = $derived(form?.sshRemotePath ?? data.storage.sshRemotePath);
	const isSshAdapter = $derived(selectedAdapter === 'ssh');

	const siteNameValue = $derived(form?.siteName ?? data.site.name);
	const siteDescriptionValue = $derived(form?.siteDescription ?? data.site.description);
	/** Null until the field is touched, so the counter starts from the loaded value. */
	let siteDescriptionTyped = $state(/** @type {number | null} */ (null));
	const siteDescriptionLength = $derived(siteDescriptionTyped ?? siteDescriptionValue.length);
	const accentColorValue = $derived(form?.accentColor ?? data.site.accentColor);
	const hideBrandingValue = $derived(form?.hideBranding ?? data.site.hideBranding);
	/** Live drafts so toggles stick before save (and children can dim with the parent). */
	let sidebarEnabledDraft = $state(/** @type {boolean | null} */ (null));
	let sidebarStatsDraft = $state(/** @type {boolean | null} */ (null));
	let sidebarFansAlsoLikeDraft = $state(/** @type {boolean | null} */ (null));
	let sidebarFollowersDraft = $state(/** @type {boolean | null} */ (null));
	let sidebarActivityDraft = $state(/** @type {boolean | null} */ (null));
	const sidebarEnabledValue = $derived(
		sidebarEnabledDraft ?? form?.sidebarEnabled ?? data.site.sidebarEnabled
	);
	const sidebarStatsValue = $derived(
		sidebarStatsDraft ?? form?.sidebarStats ?? data.site.sidebarStats
	);
	const sidebarFansAlsoLikeValue = $derived(
		sidebarFansAlsoLikeDraft ?? form?.sidebarFansAlsoLike ?? data.site.sidebarFansAlsoLike
	);
	const sidebarFollowersValue = $derived(
		sidebarFollowersDraft ?? form?.sidebarFollowers ?? data.site.sidebarFollowers
	);
	const sidebarActivityValue = $derived(
		sidebarActivityDraft ?? form?.sidebarActivity ?? data.site.sidebarActivity
	);

	/**
	 * @param {'profile' | 'email' | 'billing' | 'domain' | 'site' | 'logo' | 'og' | 'storage' | 'avatar'} which
	 */
	function busyHandler(which) {
		return () => {
			if (which === 'profile') profileBusy = true;
			if (which === 'email') emailBusy = true;
			if (which === 'billing') billingBusy = true;
			if (which === 'domain') domainBusy = true;
			if (which === 'site') siteBusy = true;
			if (which === 'logo') logoBusy = true;
			if (which === 'og') ogBusy = true;
			if (which === 'storage') storageBusy = true;
			if (which === 'avatar') avatarBusy = true;

			return async ({ update }) => {
				try {
					await update({ reset: false });
				} finally {
					if (which === 'profile') profileBusy = false;
					if (which === 'email') {
						emailBusy = false;
						emailUserOpen = true;
						emailUserClosed = false;
					}
					if (which === 'billing') billingBusy = false;
					if (which === 'domain') domainBusy = false;
					if (which === 'site') siteBusy = false;
					if (which === 'logo') logoBusy = false;
					if (which === 'og') ogBusy = false;
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
	<meta name="robots" content="noindex" />
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
					<p>How you appear across SNDBNK.</p>
				</div>

				{#if form?.avatarMessage && !avatarBusy}
					<div class="banner error" role="alert">{form.avatarMessage}</div>
				{/if}
				{#if form?.avatarSuccess && !avatarBusy}
					<div class="banner ok" role="status">{form.avatarSuccess}</div>
				{/if}
				{#if form?.profileMessage && !profileBusy}
					<div class="banner error" role="alert">{form.profileMessage}</div>
				{/if}
				{#if form?.profileSuccess && !profileBusy}
					<div class="banner ok" role="status">{form.profileSuccess}</div>
				{/if}

				<div class="profile-layout">
					<div class="profile-avatar">
						<Avatar src={data.user.image} name={data.user.name} size="5rem" />
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
						<p class="hint">JPG, PNG, or WebP · 2MB</p>
					</div>

					<div class="profile-fields">
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
					</div>
				</div>

				<div class="email-disclosure">
					<div class="email-disclosure-row">
						<p class="hint email-current">
							Sign-in: <strong>{data.user.email}</strong>
						</p>
						<button
							type="button"
							class="text-btn"
							aria-expanded={emailOpen}
							aria-controls="email-change-panel"
							onclick={toggleEmailOpen}
						>
							{emailOpen ? 'Cancel' : 'Change email'}
						</button>
					</div>

					{#if emailOpen}
						<div
							id="email-change-panel"
							class="email-panel"
							transition:slide={{ duration: prefersReducedMotion.current ? 0 : 200 }}
						>
							<p class="hint">
								We send a link to the new address; it becomes your sign-in only after you confirm.
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
					{/if}
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
								: 'Vault adds a subdomain. Studio adds a custom domain and unbranded hosting. BYO storage is on every plan.'}
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
						{#if canCustomDomain}
							Your subdomain is live. Optionally connect a custom domain (apex or subdomain).
						{:else if canSubdomain}
							Your subdomain is live. Studio unlocks a custom domain (apex or subdomain).
						{:else}
							Vault unlocks <strong>{data.profile.username}.{data.baseDomain}</strong>. Studio adds
							custom domains.
						{/if}
					</p>
				</div>

				{#if form?.domainMessage && !domainBusy}
					<div class="banner error" role="alert">{form.domainMessage}</div>
				{/if}
				{#if form?.domainSuccess && !domainBusy}
					<div class="banner ok" role="status">{form.domainSuccess}</div>
				{/if}

				{#if canSubdomain}
					<div class="domain-panel">
						<div class="url-row">
							<span class="url-label">Subdomain</span>
							{#if data.urls.subdomainUrl}
								<a href={data.urls.subdomainUrl}
									>{data.urls.subdomainUrl.replace(/^https?:\/\//, '')}</a
								>
							{:else}
								<span class="mono">{data.profile.username}.{data.baseDomain}</span>
							{/if}
						</div>
						<div class="url-row">
							<span class="url-label">Path</span>
							<a href={data.urls.pathUrl}>{data.urls.pathUrl.replace(/^https?:\/\//, '')}</a>
						</div>
						{#if data.urls.customDomainUrl}
							<div class="url-row">
								<span class="url-label">Custom</span>
								<a href={data.urls.customDomainUrl}
									>{data.urls.customDomainUrl.replace(/^https?:\/\//, '')}</a
								>
							</div>
						{/if}
					</div>
					<p class="hint">
						Subdomains work automatically once your plan includes them — no DNS for you to manage.
					</p>
				{:else}
					<div class="locked">
						<p>
							Vault unlocks
							<span class="mono">{data.profile.username}.{data.baseDomain}</span>. Studio adds a
							custom domain.
						</p>
						<a class="cta pressable" href="/plans">See plans</a>
					</div>
				{/if}

				{#if canCustomDomain}
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
							placeholder="example.com or music.example.com"
							autocapitalize="none"
							spellcheck="false"
						/>
						<p class="hint">
							Enter the exact hostname visitors will use (no https://). Apex domains and hostnames
							like music.example.com are both supported.
						</p>
						<button class="pressable" type="submit" disabled={domainBusy}>
							{domainBusy ? 'Saving…' : 'Save domain'}
						</button>
					</form>

					{#if data.profile.customDomain && data.profile.domainVerifyToken}
						<div class="dns-box" aria-label="DNS instructions">
							<div class="dns-head">
								<h3>Connect your domain</h3>
								<p class="status status-{data.profile.customDomainStatus}">{domainStatusLabel}</p>
							</div>

							{#if data.profile.customDomainStatus === 'active'}
								<p class="dns-lead">
									<strong class="mono">{data.profile.customDomain}</strong> is live on SNDBNK.
								</p>
							{:else}
								<p class="dns-lead">
									Add both records at your DNS host, then hit verify.
									<span class="dns-note">Usually live within a few minutes.</span>
								</p>
							{/if}

							<table class="dns-table" aria-label="DNS records to add">
								<thead>
									<tr class="dns-row dns-row-head">
										<th scope="col">Type</th>
										<th scope="col">Host</th>
										<th scope="col">Value</th>
									</tr>
								</thead>
								<tbody>
									{#each dnsRecords as row (row.type + row.host)}
										<tr class="dns-row">
											<td class="dns-type">{row.type}</td>
											<td>
												<code class="dns-cell">{row.host}</code>
											</td>
											<td class="dns-values">
												{#each row.values as value (value)}
													<code class="dns-cell">{value}</code>
												{/each}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>

							{#if dnsIsApex}
								<p class="hint dns-optional">
									<code>@</code> is the apex for <code>{data.profile.customDomain}</code>. Want www
									too? Same A values, or CNAME <code>www</code> →
									<code>{data.urls.cnameTarget}</code> — we accept it automatically once you’re live.
								</p>
							{/if}

							<div class="dns-actions">
								<form
									method="POST"
									action="?/verifyDomain&tab=domain"
									use:enhance={busyHandler('domain')}
								>
									<button class="pressable" type="submit" disabled={domainBusy}>
										{domainBusy
											? 'Checking…'
											: data.profile.customDomainStatus === 'active'
												? 'Re-check DNS'
												: 'Verify DNS'}
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
				{:else if canSubdomain}
					<div class="locked">
						<p>Studio unlocks a custom domain mapped to your profile.</p>
						<a class="cta pressable" href="/plans">See plans</a>
					</div>
				{/if}
			</div>
		{/if}

		{#if activeTab === 'site'}
			<div class="block" role="tabpanel" id="panel-site" aria-labelledby="tab-site">
				<div class="block-head">
					<h2>Site</h2>
					<p>
						Branding for your subdomain and custom domain. Leaves your apex profile path unchanged.
					</p>
				</div>

				{#if !canEditSite}
					<div class="locked">
						<p>
							Vault unlocks site branding on
							<span class="mono">{data.profile.username}.{data.baseDomain}</span>. Studio adds
							custom domains and unbranded hosting.
						</p>
						<a class="cta pressable" href="/plans">See plans</a>
					</div>
				{:else}
					{#if form?.logoMessage && !logoBusy}
						<div class="banner error" role="alert">{form.logoMessage}</div>
					{/if}
					{#if form?.logoSuccess && !logoBusy}
						<div class="banner ok" role="status">{form.logoSuccess}</div>
					{/if}

					<div class="avatar-block">
						{#if data.site.logoUrl}
							<img class="site-thumb" src={data.site.logoUrl} alt="" />
						{:else}
							<div class="site-thumb placeholder" aria-hidden="true">Logo</div>
						{/if}
						<div class="avatar-copy">
							<p class="avatar-title">Site logo</p>
							<p class="hint">
								Used in your tenant header and as the favicon when set. JPG, PNG, or WebP up to 2MB.
							</p>
							<div class="avatar-actions">
								<form
									class="inline-form"
									method="POST"
									action="?/uploadSiteLogo&tab=site"
									enctype="multipart/form-data"
									use:enhance={busyHandler('logo')}
								>
									<label class="file-btn" for="siteLogo">
										{logoBusy ? 'Uploading…' : data.site.logoUrl ? 'Replace' : 'Upload'}
									</label>
									<input
										id="siteLogo"
										class="visually-hidden"
										name="siteLogo"
										type="file"
										accept="image/jpeg,image/png,image/webp"
										disabled={logoBusy}
										onchange={submitOnPick}
									/>
								</form>

								{#if data.site.logoUrl}
									<form
										class="inline-form"
										method="POST"
										action="?/removeSiteLogo&tab=site"
										use:enhance={busyHandler('logo')}
									>
										<button class="text-btn" type="submit" disabled={logoBusy}>Remove</button>
									</form>
								{/if}
							</div>
						</div>
					</div>

					{#if form?.ogMessage && !ogBusy}
						<div class="banner error" role="alert">{form.ogMessage}</div>
					{/if}
					{#if form?.ogSuccess && !ogBusy}
						<div class="banner ok" role="status">{form.ogSuccess}</div>
					{/if}

					<div class="avatar-block">
						{#if data.site.ogImageUrl}
							<img class="site-thumb wide" src={data.site.ogImageUrl} alt="" />
						{:else}
							<div class="site-thumb wide placeholder" aria-hidden="true">Share</div>
						{/if}
						<div class="avatar-copy">
							<p class="avatar-title">Social share image</p>
							<p class="hint">
								Open Graph / Twitter card. Falls back to your logo, then your avatar. JPG, PNG, or
								WebP up to 2MB.
							</p>
							<div class="avatar-actions">
								<form
									class="inline-form"
									method="POST"
									action="?/uploadSiteOg&tab=site"
									enctype="multipart/form-data"
									use:enhance={busyHandler('og')}
								>
									<label class="file-btn" for="siteOg">
										{ogBusy ? 'Uploading…' : data.site.ogImageUrl ? 'Replace' : 'Upload'}
									</label>
									<input
										id="siteOg"
										class="visually-hidden"
										name="siteOg"
										type="file"
										accept="image/jpeg,image/png,image/webp"
										disabled={ogBusy}
										onchange={submitOnPick}
									/>
								</form>

								{#if data.site.ogImageUrl}
									<form
										class="inline-form"
										method="POST"
										action="?/removeSiteOg&tab=site"
										use:enhance={busyHandler('og')}
									>
										<button class="text-btn" type="submit" disabled={ogBusy}>Remove</button>
									</form>
								{/if}
							</div>
						</div>
					</div>

					{#if form?.siteMessage && !siteBusy}
						<div class="banner error" role="alert">{form.siteMessage}</div>
					{/if}
					{#if form?.siteSuccess && !siteBusy}
						<div class="banner ok" role="status">{form.siteSuccess}</div>
					{/if}

					<form method="POST" action="?/updateSite&tab=site" use:enhance={busyHandler('site')}>
						<label for="siteName">Site name</label>
						<input
							id="siteName"
							class="field-md"
							name="siteName"
							type="text"
							value={siteNameValue}
							maxlength={data.limits.siteName}
							placeholder={data.user.name}
						/>
						<p class="hint">Shown in the browser title and share cards on your tenant host.</p>

						<label for="siteDescription">Site description</label>
						<textarea
							id="siteDescription"
							class="field-lg"
							name="siteDescription"
							rows="3"
							maxlength={data.limits.siteDescription}
							oninput={(event) => {
								siteDescriptionTyped = event.currentTarget.value.length;
							}}>{siteDescriptionValue}</textarea
						>
						<p class="hint">
							{siteDescriptionLength}/{data.limits.siteDescription} — used for meta description on your
							landing page.
						</p>

						<label for="accentColor">Site accent</label>
						<div class="accent-row">
							<input
								id="accentColor"
								class="field-sm"
								name="accentColor"
								type="text"
								value={accentColorValue}
								placeholder="#C8FF00"
								autocapitalize="none"
								spellcheck="false"
								pattern={'^#[0-9A-Fa-f]{6}$'}
							/>
							{#if accentColorValue}
								<span class="accent-swatch" style:background={accentColorValue} aria-hidden="true"
								></span>
							{/if}
						</div>
						<p class="hint">
							Optional hex color for your tenant host. Leave blank for the default.
						</p>

						{#if canRemoveBranding}
							<label class="check-row">
								<input name="hideBranding" type="checkbox" checked={hideBrandingValue} />
								<span>Hide “Powered by SNDBNK” on my site</span>
							</label>
						{:else}
							<div class="locked branding-upsell">
								<p>Studio unlocks unbranded hosting (hide SNDBNK chrome on your site).</p>
								<a class="cta pressable" href="/plans">See plans</a>
							</div>
						{/if}

						{#if canCustomDomain}
							<fieldset class="sidebar-fieldset">
								<legend>Profile sidebar on your custom domain</legend>
								<p class="hint">
									Subdomain and sndbnk.com profiles always show the full sidebar. These toggles only
									apply on your custom domain.
								</p>
								<label class="check-row">
									<input
										name="sidebarEnabled"
										type="checkbox"
										checked={sidebarEnabledValue}
										onchange={(event) => (sidebarEnabledDraft = event.currentTarget.checked)}
									/>
									<span>Show profile sidebar</span>
								</label>
								<div class="sidebar-cards" class:dimmed={!sidebarEnabledValue}>
									<label class="check-row nested">
										<input
											name="sidebarStats"
											type="checkbox"
											checked={sidebarStatsValue}
											disabled={!sidebarEnabledValue}
											onchange={(event) => (sidebarStatsDraft = event.currentTarget.checked)}
										/>
										{#if !sidebarEnabledValue}
											<input
												type="hidden"
												name="sidebarStats"
												value={sidebarStatsValue ? 'on' : ''}
											/>
										{/if}
										<span>Stats</span>
									</label>
									<label class="check-row nested">
										<input
											name="sidebarFansAlsoLike"
											type="checkbox"
											checked={sidebarFansAlsoLikeValue}
											disabled={!sidebarEnabledValue}
											onchange={(event) => (sidebarFansAlsoLikeDraft = event.currentTarget.checked)}
										/>
										{#if !sidebarEnabledValue}
											<input
												type="hidden"
												name="sidebarFansAlsoLike"
												value={sidebarFansAlsoLikeValue ? 'on' : ''}
											/>
										{/if}
										<span>Fans Also Like</span>
									</label>
									<label class="check-row nested">
										<input
											name="sidebarFollowers"
											type="checkbox"
											checked={sidebarFollowersValue}
											disabled={!sidebarEnabledValue}
											onchange={(event) => (sidebarFollowersDraft = event.currentTarget.checked)}
										/>
										{#if !sidebarEnabledValue}
											<input
												type="hidden"
												name="sidebarFollowers"
												value={sidebarFollowersValue ? 'on' : ''}
											/>
										{/if}
										<span>Followers</span>
									</label>
									<label class="check-row nested">
										<input
											name="sidebarActivity"
											type="checkbox"
											checked={sidebarActivityValue}
											disabled={!sidebarEnabledValue}
											onchange={(event) => (sidebarActivityDraft = event.currentTarget.checked)}
										/>
										{#if !sidebarEnabledValue}
											<input
												type="hidden"
												name="sidebarActivity"
												value={sidebarActivityValue ? 'on' : ''}
											/>
										{/if}
										<span>Last Comments</span>
									</label>
								</div>
							</fieldset>
						{/if}

						<button class="pressable" type="submit" disabled={siteBusy}>
							{siteBusy ? 'Saving…' : 'Save site settings'}
						</button>
					</form>
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
							Bringing your own storage is not on {data.billing.planLabel}. Your uploads stay on
							SNDBNK hosted storage.
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
											<span class="coming-soon">Upgrade</span>
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
		margin-bottom: 1.75rem;
	}

	.page-head > .eyebrow {
		margin: 0 0 0.25rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.1rem, 5.5vw, 3.25rem);
		line-height: 0.95;
		animation: rise 0.65s ease both;
	}

	.intro {
		max-width: 34rem;
		margin: 0.3rem 0 0;
		color: var(--muted);
		line-height: 1.35;
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
		margin: 0.25rem 0 0.35rem;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: clamp(1.75rem, 4.5vw, 2.35rem);
		font-weight: 400;
		letter-spacing: -0.03em;
	}

	.block-head p:last-child {
		margin: 0;
		color: var(--muted);
		line-height: 1.4;
	}

	form {
		display: grid;
		margin-top: 1.5rem;
	}

	.profile-layout {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1.15rem 1.5rem;
		align-items: start;
		margin-top: 1.25rem;
	}

	.profile-avatar {
		display: grid;
		gap: 0.55rem;
		justify-items: start;
	}

	.profile-avatar .avatar-actions {
		flex-direction: column;
		align-items: flex-start;
		gap: 0.35rem;
	}

	.profile-avatar .file-btn {
		padding: 0.4rem 0.65rem;
		font-size: 0.65rem;
	}

	.profile-avatar .hint {
		max-width: 7.5rem;
		margin: 0;
		line-height: 1.35;
	}

	.profile-fields form {
		margin-top: 0;
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

	.site-thumb {
		flex: 0 0 auto;
		width: 5rem;
		height: 5rem;
		object-fit: cover;
		border: 1px solid var(--ink);
		background: var(--field-surface);
	}

	.site-thumb.wide {
		width: 8.5rem;
		height: 5rem;
	}

	.site-thumb.placeholder {
		display: grid;
		place-items: center;
		color: var(--muted);
		font-size: 0.65rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.accent-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 0.35rem;
	}

	.accent-row .field-sm {
		margin-bottom: 0;
	}

	.accent-swatch {
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--ink);
	}

	.check-row {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		margin: 1.25rem 0 0.5rem;
		font-size: 0.95rem;
		font-weight: 500;
		letter-spacing: 0;
		text-transform: none;
		cursor: pointer;
	}

	.check-row input {
		width: 1.1rem;
		height: 1.1rem;
		accent-color: var(--accent);
	}

	.check-row.nested {
		margin: 0.35rem 0;
	}

	.sidebar-fieldset {
		margin: 1.5rem 0 0.75rem;
		padding: 0;
		border: none;
	}

	.sidebar-fieldset legend {
		padding: 0;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.sidebar-fieldset > .hint {
		margin: 0.45rem 0 0.25rem;
	}

	.sidebar-cards {
		display: grid;
		gap: 0;
		margin: 0.25rem 0 0 1.5rem;
		padding-left: 0.75rem;
		border-left: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.sidebar-cards.dimmed {
		opacity: 0.55;
	}

	.sidebar-cards.dimmed .check-row {
		cursor: default;
	}

	.branding-upsell {
		margin-bottom: 0.5rem;
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

	.email-disclosure {
		margin-top: 1.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.email-disclosure-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 1rem;
		align-items: baseline;
		justify-content: space-between;
	}

	.email-current {
		margin: 0;
	}

	.email-panel {
		margin-top: 0.85rem;
	}

	.email-panel form {
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

	/* Transparent buttons sit on --paper, so they need --ink rather than the
	   --on-accent colour that only reads against the accent fill. */
	.pressable.ghost,
	.pressable.danger {
		border-color: var(--hard-border);
		color: var(--ink);
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
		padding: 1.35rem;
		border: 1px solid var(--hard-border);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		box-shadow: 6px 6px 0 var(--hard-shadow);
	}

	.dns-head {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.85rem;
	}

	.dns-head h3 {
		margin: 0;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 1.35rem;
		font-weight: 400;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.dns-lead {
		margin: 0 0 1.1rem;
		font-size: 0.9rem;
		font-weight: 700;
		line-height: 1.45;
	}

	.dns-note {
		display: inline;
		margin-left: 0.35rem;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 600;
	}

	.dns-table {
		width: 100%;
		border-collapse: collapse;
		border: 1px solid var(--ink);
		background: var(--paper);
	}

	.dns-row th,
	.dns-row td {
		padding: 0.7rem 0.85rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
		text-align: left;
		vertical-align: top;
	}

	.dns-row:first-child th {
		border-top: 0;
	}

	.dns-row-head th {
		padding-top: 0.55rem;
		padding-bottom: 0.55rem;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.dns-type {
		width: 4.5rem;
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.dns-values {
		display: grid;
		gap: 0.35rem;
		min-width: 0;
	}

	.dns-cell {
		display: block;
		min-width: 0;
		padding: 0.2rem 0.35rem;
		border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
		background: color-mix(in srgb, var(--ink) 3%, transparent);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.78rem;
		font-weight: 600;
		line-height: 1.35;
		word-break: break-all;
		user-select: all;
	}

	.dns-optional {
		margin: 0.85rem 0 0;
	}

	.dns-optional code {
		padding: 0.05rem 0.25rem;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		background: var(--paper);
		font-size: 0.72rem;
		word-break: break-all;
		user-select: all;
	}

	.dns-box .status-pending {
		border-color: var(--accent);
		color: var(--ink);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
	}

	.dns-box .status-none {
		color: var(--muted);
		background: transparent;
	}

	.dns-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.1rem;
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
			margin-bottom: 1.25rem;
		}

		.intro {
			display: none;
		}

		.profile-layout {
			grid-template-columns: 1fr;
		}

		.current-meta {
			text-align: left;
		}

		.url-row {
			grid-template-columns: 1fr;
			gap: 0.2rem;
		}

		.dns-row,
		.dns-row th,
		.dns-row td {
			display: block;
			width: 100%;
		}

		.dns-row-head {
			display: none;
		}

		.dns-row td {
			padding: 0.35rem 0.85rem;
			border-top: 0;
		}

		.dns-row td:first-child {
			padding-top: 0.7rem;
			border-top: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
		}

		.dns-row td:last-child {
			padding-bottom: 0.7rem;
		}

		.dns-row:first-child td:first-child {
			border-top: 0;
		}

		.dns-type {
			width: auto;
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
