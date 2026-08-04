<script>
	import IconSearch from '@tabler/icons-svelte-runes/icons/search';
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import SiteHeader from '#lib/components/SiteHeader.svelte';

	let { data, form } = $props();

	const sections = [
		{ id: 'plans', label: 'Plans' },
		{ id: 'discounts', label: 'Discounts' },
		{ id: 'users', label: 'Users' },
		{ id: 'site', label: 'Site' },
		{ id: 'planning', label: 'Business planning' }
	];

	const planningDocs = [
		{
			slug: 'business-plan',
			title: 'Founder plan',
			blurb: 'North star, wedge, shipped product, and what to build next.'
		},
		{
			slug: 'business-finance',
			title: 'Finance & ramp',
			blurb: 'Burn rate, budget buckets, break-even math, and money next steps.'
		},
		{
			slug: 'drizzle-migrations',
			title: 'Schema migrations',
			blurb: 'Drizzle generate → review → migrate ops guide for SQLite.'
		}
	];

	function sectionFromUrl() {
		const requested = page.url.searchParams.get('section');
		return sections.find((section) => section.id === requested)?.id ?? 'plans';
	}

	let activeSection = $state(sectionFromUrl());
	let planBusy = $state(false);
	let promoBusy = $state(false);
	let userBusy = $state(false);
	let siteBusy = $state(false);
	const siteSettings = $derived(form?.siteSettings ?? data.siteSettings);
	/** @type {string | null} */
	let openPlan = $state(null);
	let promoDuration = $state('once');
	/** @type {string | null} */
	let deleteConfirmUserId = $state(null);
	let purgeChecked = $state(false);

	/**
	 * @param {string} id
	 */
	function selectSection(id) {
		activeSection = id;
		deleteConfirmUserId = null;
		purgeChecked = false;

		const url = new URL(page.url);
		url.searchParams.set('section', id);
		replaceState(url, page.state);
	}

	/**
	 * @param {string} userId
	 */
	function openDeleteConfirm(userId) {
		if (deleteConfirmUserId === userId) {
			deleteConfirmUserId = null;
			purgeChecked = false;
			return;
		}
		deleteConfirmUserId = userId;
		purgeChecked = false;
	}

	function closeDeleteConfirm() {
		deleteConfirmUserId = null;
		purgeChecked = false;
	}

	/** @type {import('svelte/attachments').Attachment} */
	function deleteConfirmAttach(node) {
		/** @param {PointerEvent} event */
		function onPointerDown(event) {
			if (!deleteConfirmUserId) return;
			const target = /** @type {Node | null} */ (event.target);
			if (target && !node.contains(target)) closeDeleteConfirm();
		}

		/** @param {KeyboardEvent} event */
		function onKeydown(event) {
			if (event.key === 'Escape') closeDeleteConfirm();
		}

		document.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('keydown', onKeydown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('keydown', onKeydown);
		};
	}

	function deleteBusyHandler() {
		userBusy = true;
		return async ({ update }) => {
			try {
				await update();
				closeDeleteConfirm();
			} finally {
				userBusy = false;
			}
		};
	}

	/**
	 * @param {KeyboardEvent & { currentTarget: HTMLButtonElement }} event
	 */
	function handleTabKeydown(event) {
		const current = sections.findIndex((section) => section.id === activeSection);

		let next = -1;
		if (event.key === 'ArrowRight') next = (current + 1) % sections.length;
		if (event.key === 'ArrowLeft') next = (current - 1 + sections.length) % sections.length;
		if (event.key === 'Home') next = 0;
		if (event.key === 'End') next = sections.length - 1;
		if (next === -1) return;

		event.preventDefault();
		selectSection(sections[next].id);

		const sibling = event.currentTarget.parentElement?.children[next];
		if (sibling instanceof HTMLElement) sibling.focus();
	}

	/**
	 * @param {'plan' | 'promo' | 'user' | 'site'} which
	 */
	function busyHandler(which) {
		return () => {
			if (which === 'plan') planBusy = true;
			if (which === 'promo') promoBusy = true;
			if (which === 'user') userBusy = true;
			if (which === 'site') siteBusy = true;

			return async ({ update }) => {
				try {
					await update();
				} finally {
					if (which === 'plan') planBusy = false;
					if (which === 'promo') promoBusy = false;
					if (which === 'user') userBusy = false;
					if (which === 'site') siteBusy = false;
				}
			};
		};
	}

	/**
	 * @param {{ percentOff: number | null, amountOff: number | null }} promotion
	 */
	function discountLabel(promotion) {
		if (promotion.percentOff) return `${promotion.percentOff}% off`;
		if (promotion.amountOff) return `$${(promotion.amountOff / 100).toFixed(2)} off`;
		return '—';
	}

	/**
	 * @param {number | null} ms
	 */
	function shortDate(ms) {
		return ms
			? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(ms))
			: '—';
	}

	/**
	 * @param {number} value
	 */
	function bytesLabel(value) {
		if (value < 1024) return `${value} B`;
		const units = ['KB', 'MB', 'GB', 'TB'];
		let n = value / 1024;
		let i = 0;
		while (n >= 1024 && i < units.length - 1) {
			n /= 1024;
			i += 1;
		}
		return `${n >= 10 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
	}

	/**
	 * @param {number} localBytes
	 * @param {number | null} maxLocalBytes
	 */
	function storageFill(localBytes, maxLocalBytes) {
		if (!maxLocalBytes) return 0;
		return Math.min(100, Math.round((localBytes / maxLocalBytes) * 100));
	}

	/**
	 * @param {{ username: string | null, email: string }} account
	 */
	function accountLabel(account) {
		return account.username ? `@${account.username}` : account.email;
	}
</script>

<svelte:head>
	<title>Admin | SNDBNK</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="admin-page">
	<SiteHeader />

	<main>
		<header class="page-head">
			<p class="eyebrow eyebrow-chip accent-text">Superuser</p>
			<h1 class="display-face">Admin</h1>
			<p class="intro">
				Plan limits, discount codes, accounts, site playback rules, and founder planning docs.
				Changes here are immediate.
			</p>
		</header>

		{#if !data.billingEnabled}
			<div class="banner error" role="alert">
				No Stripe key on this server. Plan limits still save locally, but prices and discount codes
				cannot be pushed.
			</div>
		{/if}

		<div class="tab-bar" role="tablist" aria-label="Admin sections">
			{#each sections as section (section.id)}
				<button
					type="button"
					role="tab"
					id="tab-{section.id}"
					class="tab"
					class:active={activeSection === section.id}
					aria-selected={activeSection === section.id}
					aria-controls="panel-{section.id}"
					tabindex={activeSection === section.id ? 0 : -1}
					onclick={() => selectSection(section.id)}
					onkeydown={handleTabKeydown}
				>
					{section.label}
				</button>
			{/each}
		</div>

		{#if activeSection === 'plans'}
			<div class="block" role="tabpanel" id="panel-plans" aria-labelledby="tab-plans">
				<div class="block-head">
					<h2>Plans</h2>
					<p>
						Limits are enforced from here. Changing a price creates a new Stripe Price and moves the
						lookup key, so current subscribers keep the rate they signed up at.
					</p>
				</div>

				{#if form?.planMessage && !planBusy}
					<div class="banner error" role="alert">{form.planMessage}</div>
				{/if}
				{#if form?.planSuccess && !planBusy}
					<div class="banner ok" role="status">{form.planSuccess}</div>
				{/if}

				<div class="plan-list">
					{#each data.plans as tier (tier.id)}
						<article class="plan-row" class:inactive={!tier.active}>
							<div class="plan-summary">
								<div>
									<h3>{tier.label}</h3>
									<p class="plan-meta">
										{tier.subscribers} account{tier.subscribers === 1 ? '' : 's'} ·
										{tier.maxTracks ?? 'unlimited'} tracks ·
										{tier.maxLocalGib === null ? 'unlimited' : `${tier.maxLocalGib} GB`} hosted
										{#if !tier.active}· retired{/if}
									</p>
								</div>
								<div class="plan-actions">
									<span class="price-tag">
										{tier.free ? 'Free' : `$${tier.monthlyDollars}/mo · $${tier.yearlyDollars}/yr`}
									</span>
									{#if !tier.free}
										<span class="sync-state" class:ok={tier.hasPrices}>
											{tier.hasPrices ? 'In Stripe' : 'Not in Stripe'}
										</span>
									{/if}
									<button
										class="pressable ghost small"
										type="button"
										onclick={() => (openPlan = openPlan === tier.id ? null : tier.id)}
										aria-expanded={openPlan === tier.id}
									>
										{openPlan === tier.id ? 'Close' : 'Edit'}
									</button>
								</div>
							</div>

							{#if openPlan === tier.id}
								<form
									class="plan-form"
									method="POST"
									action="?/savePlan&section=plans"
									use:enhance={busyHandler('plan')}
									aria-busy={planBusy}
								>
									<input type="hidden" name="planId" value={tier.id} />

									<div class="field-grid">
										<div class="field">
											<label for="{tier.id}-label">Label</label>
											<input
												id="{tier.id}-label"
												name="label"
												type="text"
												value={tier.label}
												required
											/>
										</div>
										<div class="field">
											<label for="{tier.id}-blurb">Blurb</label>
											<input id="{tier.id}-blurb" name="blurb" type="text" value={tier.blurb} />
										</div>
										<div class="field">
											<label for="{tier.id}-monthly">Monthly ($)</label>
											<input
												id="{tier.id}-monthly"
												name="monthlyDollars"
												type="text"
												inputmode="decimal"
												value={tier.monthlyDollars}
											/>
										</div>
										<div class="field">
											<label for="{tier.id}-yearly">Yearly ($)</label>
											<input
												id="{tier.id}-yearly"
												name="yearlyDollars"
												type="text"
												inputmode="decimal"
												value={tier.yearlyDollars}
											/>
										</div>
										<div class="field">
											<label for="{tier.id}-tracks">Max tracks</label>
											<input
												id="{tier.id}-tracks"
												name="maxTracks"
												type="text"
												inputmode="numeric"
												value={tier.maxTracks ?? ''}
												placeholder="blank = unlimited"
											/>
										</div>
										<div class="field">
											<label for="{tier.id}-storage">Hosted storage (GB)</label>
											<input
												id="{tier.id}-storage"
												name="maxLocalGib"
												type="text"
												inputmode="decimal"
												value={tier.maxLocalGib ?? ''}
												placeholder="blank = unlimited"
											/>
										</div>
										<div class="field">
											<label for="{tier.id}-seats">Team seats</label>
											<input
												id="{tier.id}-seats"
												name="maxTeamSeats"
												type="text"
												inputmode="numeric"
												value={tier.maxTeamSeats}
												placeholder="0"
											/>
										</div>
									</div>

									<div class="field">
										<label for="{tier.id}-features">Features, one per line</label>
										<textarea id="{tier.id}-features" name="features" rows="5"
											>{tier.features.join('\n')}</textarea
										>
									</div>

									<fieldset class="toggles">
										<legend>Entitlements</legend>
										<label>
											<input
												type="checkbox"
												name="allowStorageAdapters"
												checked={tier.allowStorageAdapters}
											/>
											Bring your own storage
										</label>
										<label>
											<input type="checkbox" name="allowSubdomain" checked={tier.allowSubdomain} />
											Subdomain hosting
										</label>
										<label>
											<input
												type="checkbox"
												name="allowCustomDomain"
												checked={tier.allowCustomDomain}
											/>
											Custom domain
										</label>
										<label>
											<input
												type="checkbox"
												name="allowRemoveBranding"
												checked={tier.allowRemoveBranding}
											/>
											Remove SNDBNK branding
										</label>
										<label>
											<input type="checkbox" name="active" checked={tier.active} />
											Offered to new subscribers
										</label>
									</fieldset>

									<div class="row-actions">
										<button class="pressable" type="submit" disabled={planBusy}>
											{planBusy ? 'Saving…' : 'Save plan'}
										</button>
									</div>
								</form>

								{#if !tier.free}
									<form
										class="sync-form"
										method="POST"
										action="?/syncPlan&section=plans"
										use:enhance={busyHandler('plan')}
									>
										<input type="hidden" name="planId" value={tier.id} />
										<button
											class="pressable ghost small"
											type="submit"
											disabled={planBusy || !data.billingEnabled}
										>
											Re-sync to Stripe
										</button>
										<p class="hint">
											Recreates the Product and Prices from these values. Safe to run repeatedly.
										</p>
									</form>
								{/if}
							{/if}
						</article>
					{/each}
				</div>
			</div>
		{/if}

		{#if activeSection === 'discounts'}
			<div class="block" role="tabpanel" id="panel-discounts" aria-labelledby="tab-discounts">
				<div class="block-head">
					<h2>Discounts</h2>
					<p>
						Each code is a Stripe Coupon plus a Promotion Code. Codes cannot be deleted once
						redeemed, only deactivated.
					</p>
				</div>

				{#if form?.promoMessage && !promoBusy}
					<div class="banner error" role="alert">{form.promoMessage}</div>
				{/if}
				{#if form?.promoSuccess && !promoBusy}
					<div class="banner ok" role="status">{form.promoSuccess}</div>
				{/if}

				<form
					class="promo-form"
					method="POST"
					action="?/createPromotion&section=discounts"
					use:enhance={busyHandler('promo')}
					aria-busy={promoBusy}
				>
					<div class="field-grid">
						<div class="field">
							<label for="promo-code">Code</label>
							<input
								id="promo-code"
								name="code"
								type="text"
								autocapitalize="characters"
								spellcheck="false"
								placeholder="LAUNCH25"
								required
							/>
						</div>
						<div class="field">
							<label for="promo-percent">Percent off</label>
							<input
								id="promo-percent"
								name="percentOff"
								type="text"
								inputmode="decimal"
								placeholder="25"
							/>
						</div>
						<div class="field">
							<label for="promo-amount">Or dollars off</label>
							<input
								id="promo-amount"
								name="amountOff"
								type="text"
								inputmode="decimal"
								placeholder="5.00"
							/>
						</div>
						<div class="field">
							<label for="promo-duration">Applies</label>
							<select id="promo-duration" name="duration" bind:value={promoDuration}>
								<option value="once">First invoice only</option>
								<option value="repeating">For a number of months</option>
								<option value="forever">Forever</option>
							</select>
						</div>
						{#if promoDuration === 'repeating'}
							<div class="field">
								<label for="promo-months">Months</label>
								<input
									id="promo-months"
									name="durationInMonths"
									type="text"
									inputmode="numeric"
									placeholder="3"
								/>
							</div>
						{/if}
						<div class="field">
							<label for="promo-max">Max redemptions</label>
							<input
								id="promo-max"
								name="maxRedemptions"
								type="text"
								inputmode="numeric"
								placeholder="blank = unlimited"
							/>
						</div>
					</div>

					<button class="pressable" type="submit" disabled={promoBusy || !data.billingEnabled}>
						{promoBusy ? 'Creating…' : 'Create code'}
					</button>
				</form>

				{#if data.promotions.length > 0}
					<table class="data-table">
						<thead>
							<tr>
								<th scope="col">Code</th>
								<th scope="col">Discount</th>
								<th scope="col">Applies</th>
								<th scope="col">Used</th>
								<th scope="col">Expires</th>
								<th scope="col"><span class="visually-hidden">Actions</span></th>
							</tr>
						</thead>
						<tbody>
							{#each data.promotions as promotion (promotion.id)}
								<tr class:inactive={!promotion.active}>
									<td><code>{promotion.code}</code></td>
									<td>{discountLabel(promotion)}</td>
									<td>
										{promotion.duration === 'repeating'
											? `${promotion.durationInMonths} months`
											: promotion.duration === 'forever'
												? 'Forever'
												: 'First invoice'}
									</td>
									<td
										>{promotion.timesRedeemed}{promotion.maxRedemptions
											? ` / ${promotion.maxRedemptions}`
											: ''}</td
									>
									<td>{shortDate(promotion.expiresAt)}</td>
									<td class="cell-actions">
										{#if promotion.active}
											<form
												method="POST"
												action="?/archivePromotion&section=discounts"
												use:enhance={busyHandler('promo')}
											>
												<input type="hidden" name="promotionCodeId" value={promotion.id} />
												<button class="pressable ghost small" type="submit" disabled={promoBusy}>
													Deactivate
												</button>
											</form>
										{:else}
											<span class="hint">Inactive</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<p class="empty">No promotion codes yet.</p>
				{/if}
			</div>
		{/if}

		{#if activeSection === 'site'}
			<div class="block" role="tabpanel" id="panel-site" aria-labelledby="tab-site">
				<div class="block-head">
					<h2>Site</h2>
					<p>
						When a listen counts as a play. Tracks (and samples, loops, podcasts) use a percent of
						duration; mixes use accumulated playtime while audio is actually playing.
					</p>
				</div>

				{#if form?.siteMessage && !siteBusy}
					<div class="banner error" role="alert">{form.siteMessage}</div>
				{/if}
				{#if form?.siteSuccess && !siteBusy}
					<div class="banner ok" role="status">{form.siteSuccess}</div>
				{/if}

				<form
					class="site-form"
					method="POST"
					action="?/saveSiteSettings&section=site"
					aria-label="Play thresholds"
					aria-busy={siteBusy}
					use:enhance={busyHandler('site')}
				>
					<div class="field-grid">
						<div class="field">
							<label for="track-play-percent">Track play percent</label>
							<input
								id="track-play-percent"
								type="number"
								name="trackPlayPercent"
								min="1"
								max="100"
								step="1"
								required
								value={siteSettings.trackPlayPercent}
								disabled={siteBusy}
							/>
							<p class="hint">
								Accumulated playing time as a percent of duration (pauses OK; seeking does not
								count).
							</p>
						</div>
						<div class="field">
							<label for="mix-play-minutes">Mix continual play (minutes)</label>
							<input
								id="mix-play-minutes"
								type="number"
								name="mixPlayContinualMinutes"
								min="1"
								step="0.5"
								required
								value={siteSettings.mixPlayContinualMinutes}
								disabled={siteBusy}
							/>
							<p class="hint">
								Accumulated playing time for mixes (pauses OK; seeking does not count). Short mixes
								still count when finished.
							</p>
						</div>
					</div>
					<button class="pressable accent-fill" type="submit" disabled={siteBusy}>
						{siteBusy ? 'Saving…' : 'Save thresholds'}
					</button>
				</form>
			</div>
		{/if}

		{#if activeSection === 'planning'}
			<div class="block" role="tabpanel" id="panel-planning" aria-labelledby="tab-planning">
				<div class="block-head">
					<h2>Business planning</h2>
					<p>
						Admin-only briefs from <code>docs/</code>. Open in a new tab — same standalone HTML you
						can still open on disk.
					</p>
				</div>

				<ul class="planning-list">
					{#each planningDocs as doc (doc.slug)}
						<li>
							<a class="planning-card" href="/admin/docs/{doc.slug}" target="_blank" rel="noopener">
								<span class="planning-title">{doc.title}</span>
								<span class="planning-blurb">{doc.blurb}</span>
								<span class="planning-path">/admin/docs/{doc.slug}</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if activeSection === 'users'}
			<div class="block" role="tabpanel" id="panel-users" aria-labelledby="tab-users">
				<div class="block-head">
					<h2>Users</h2>
					<p>Comping a plan sets it without a Stripe subscription, so nothing is ever charged.</p>
				</div>

				{#if form?.userMessage && !userBusy}
					<div class="banner error" role="alert">{form.userMessage}</div>
				{/if}
				{#if form?.userSuccess && !userBusy}
					<div class="banner ok" role="status">{form.userSuccess}</div>
				{/if}

				<form class="search" method="GET" role="search">
					<input type="hidden" name="section" value="users" />
					<label class="visually-hidden" for="user-search">Search accounts</label>
					<input
						id="user-search"
						name="q"
						type="search"
						value={data.query}
						placeholder="Name, email, or username"
					/>
					<button class="pressable ghost small" type="submit">
						<IconSearch size={14} stroke={2} aria-hidden="true" />
						Search
					</button>
				</form>

				{#if data.users.length > 0}
					<table class="data-table">
						<thead>
							<tr>
								<th scope="col">Account</th>
								<th scope="col">Plan</th>
								<th scope="col">Storage</th>
								<th scope="col">Tracks</th>
								<th scope="col">Joined</th>
								<th scope="col">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each data.users as account (account.userId)}
								<tr class:inactive={account.banned}>
									<td>
										<span class="account-name">{account.name}</span>
										<span class="account-meta">
											{account.username ? `@${account.username} · ` : ''}{account.email}
											{#if account.role === 'admin'}<span class="badge">admin</span>{/if}
											{#if account.banned}<span class="badge">banned</span>{/if}
										</span>
									</td>
									<td>
										<form
											class="inline-form"
											method="POST"
											action="?/setUserPlan&section=users"
											use:enhance={busyHandler('user')}
										>
											<input type="hidden" name="userId" value={account.userId} />
											<label class="visually-hidden" for="plan-{account.userId}">Plan</label>
											<select id="plan-{account.userId}" name="plan" disabled={userBusy}>
												{#each data.plans as tier (tier.id)}
													<option value={tier.id} selected={tier.id === account.plan}>
														{tier.label}
													</option>
												{/each}
											</select>
											<button class="pressable ghost small" type="submit" disabled={userBusy}>
												Set
											</button>
										</form>
										{#if account.subscriptionStatus}
											<span class="account-meta">{account.subscriptionStatus}</span>
										{/if}
									</td>
									<td>
										<div
											class="storage-meter"
											aria-label="Hosted storage for {accountLabel(account)}"
										>
											<div class="meter-head">
												<span class="meter-label">Hosted</span>
												<span class="meter-value">
													{#if account.maxLocalBytes !== null}
														{bytesLabel(account.localBytes)} / {bytesLabel(account.maxLocalBytes)}
													{:else}
														{bytesLabel(account.localBytes)}
													{/if}
												</span>
											</div>
											<div
												class="meter-track"
												role="progressbar"
												aria-valuenow={account.localBytes}
												aria-valuemin="0"
												aria-valuemax={account.maxLocalBytes ?? account.localBytes}
												aria-label="Hosted storage used"
											>
												<span
													class="meter-fill"
													style="width: {account.maxLocalBytes !== null
														? storageFill(account.localBytes, account.maxLocalBytes)
														: 0}%"
												></span>
											</div>
										</div>
									</td>
									<td>{account.trackCount}</td>
									<td>{shortDate(account.createdAt)}</td>
									<td class="cell-actions">
										<form
											method="POST"
											action="?/setUserRole&section=users"
											use:enhance={busyHandler('user')}
										>
											<input type="hidden" name="userId" value={account.userId} />
											<input
												type="hidden"
												name="role"
												value={account.role === 'admin' ? 'user' : 'admin'}
											/>
											<button class="pressable ghost small" type="submit" disabled={userBusy}>
												{account.role === 'admin' ? 'Revoke admin' : 'Make admin'}
											</button>
										</form>
										<form
											method="POST"
											action="?/setUserBanned&section=users"
											use:enhance={busyHandler('user')}
										>
											<input type="hidden" name="userId" value={account.userId} />
											<input
												type="hidden"
												name="banned"
												value={account.banned ? 'false' : 'true'}
											/>
											<button
												class="pressable ghost small danger"
												type="submit"
												disabled={userBusy}
											>
												{account.banned ? 'Unban' : 'Ban'}
											</button>
										</form>
										{#if account.userId !== data.viewerId}
											<div
												class="delete-wrap"
												{@attach deleteConfirmUserId === account.userId && deleteConfirmAttach}
											>
												<button
													type="button"
													class="pressable ghost small danger"
													aria-expanded={deleteConfirmUserId === account.userId}
													aria-haspopup="dialog"
													aria-controls="delete-confirm-{account.userId}"
													disabled={userBusy}
													onclick={() => openDeleteConfirm(account.userId)}
												>
													Delete
												</button>
												{#if deleteConfirmUserId === account.userId}
													<form
														id="delete-confirm-{account.userId}"
														class="delete-panel"
														method="POST"
														action="?/deleteUser&section=users"
														aria-label="Confirm delete {accountLabel(account)}"
														aria-busy={userBusy}
														use:enhance={deleteBusyHandler}
													>
														<input type="hidden" name="userId" value={account.userId} />
														<p class="delete-warn">
															Delete {accountLabel(account)}? This cannot be undone.
														</p>
														<label class="purge-check">
															<input
																type="checkbox"
																name="purge"
																bind:checked={purgeChecked}
																disabled={userBusy}
															/>
															<span>Permanently delete this user and all their data</span>
														</label>
														<div class="delete-actions">
															<button
																type="button"
																class="pressable ghost small"
																disabled={userBusy}
																onclick={closeDeleteConfirm}
															>
																Cancel
															</button>
															<button
																class="pressable small danger"
																type="submit"
																disabled={userBusy || !purgeChecked}
															>
																{userBusy ? 'Deleting…' : 'Delete'}
															</button>
														</div>
													</form>
												{/if}
											</div>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<p class="empty">No accounts matched “{data.query}”.</p>
				{/if}
			</div>
		{/if}
	</main>
</div>

<style>
	.admin-page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 5rem;
	}

	.page-head {
		margin-bottom: 2rem;
	}

	.page-head .eyebrow {
		margin: 0 0 0.85rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.4rem, 5vw, 3.6rem);
		line-height: 0.95;
	}

	.intro {
		margin: 1rem 0 0;
		color: var(--muted);
		line-height: 1.5;
	}

	.tab-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 2rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
	}

	.tab {
		padding: 0.7rem 1.1rem;
		border: 1px solid transparent;
		border-bottom: 0;
		border-radius: 0;
		color: var(--muted);
		background: transparent;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.tab.active {
		margin-bottom: -1px;
		border-color: color-mix(in srgb, var(--ink) 20%, transparent);
		color: var(--ink);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
	}

	.block-head h2 {
		margin: 0;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 1.8rem;
		font-weight: 400;
		letter-spacing: -0.03em;
	}

	.block-head p {
		max-width: 46rem;
		margin: 0.6rem 0 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.5;
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
		background: color-mix(in srgb, var(--accent) 25%, transparent);
	}

	.banner.ok {
		color: var(--on-accent);
		background: var(--accent);
	}

	.plan-list {
		display: grid;
		gap: 1rem;
		margin-top: 1.75rem;
	}

	.planning-list {
		display: grid;
		gap: 0.85rem;
		margin: 1.75rem 0 0;
		padding: 0;
		list-style: none;
	}

	.planning-card {
		display: grid;
		gap: 0.35rem;
		padding: 1.1rem 1.2rem;
		border: 1px solid var(--hard-border);
		box-shadow: 4px 4px 0 var(--hard-shadow);
		color: inherit;
		text-decoration: none;
		background: var(--paper);
	}

	.planning-card:hover {
		background: color-mix(in srgb, var(--accent) 14%, var(--paper));
	}

	.planning-title {
		font-size: 1.1rem;
		font-weight: 700;
	}

	.planning-blurb {
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.45;
	}

	.planning-path {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.75rem;
		color: color-mix(in srgb, var(--ink) 70%, var(--muted));
	}

	.plan-row {
		padding: 1.15rem 1.25rem;
		border: 1px solid var(--hard-border);
	}

	.plan-row.inactive,
	tr.inactive {
		opacity: 0.6;
	}

	.plan-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
	}

	.plan-summary h3 {
		margin: 0;
		font-size: 1.15rem;
	}

	.plan-meta {
		margin: 0.3rem 0 0;
		color: var(--muted);
		font-size: 0.75rem;
	}

	.plan-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	.price-tag {
		font-size: 0.78rem;
		font-weight: 700;
	}

	.sync-state {
		padding: 0.15rem 0.45rem;
		border: 1px solid color-mix(in srgb, var(--ink) 40%, transparent);
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.sync-state.ok {
		border-color: var(--ink);
		color: var(--on-accent);
		background: var(--accent);
	}

	.site-form {
		margin-top: 1.5rem;
		max-width: 36rem;
	}

	.plan-form,
	.promo-form {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.field {
		display: grid;
	}

	label {
		margin: 0 0 0.45rem;
		font-size: 0.65rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	input,
	select,
	textarea {
		width: 100%;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--field-border);
		border-radius: 0;
		color: var(--ink);
		background: var(--field-surface);
		font-family: inherit;
		font-size: 0.85rem;
		outline: none;
	}

	input:focus,
	select:focus,
	textarea:focus {
		box-shadow: 4px 4px 0 var(--accent);
	}

	textarea {
		resize: vertical;
	}

	.toggles {
		display: grid;
		gap: 0.5rem;
		margin: 0 0 1.25rem;
		padding: 1rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}

	.toggles legend {
		padding: 0 0.4rem;
		font-size: 0.65rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.toggles label {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		margin: 0;
		font-size: 0.82rem;
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
	}

	.toggles input {
		width: auto;
		accent-color: var(--accent);
	}

	.pressable {
		padding: 0.7rem 1.1rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.pressable.ghost {
		border-color: var(--hard-border);
		color: var(--ink);
		background: transparent;
	}

	.pressable.small {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		padding: 0.45rem 0.7rem;
		box-shadow: 3px 3px 0 var(--hard-shadow);
		font-size: 0.62rem;
		white-space: nowrap;
	}

	.pressable.small :global(svg) {
		display: block;
	}

	.pressable:disabled {
		opacity: 0.55;
		box-shadow: 2px 2px 0 var(--hard-shadow);
		cursor: not-allowed;
	}

	.sync-form {
		margin-top: 1.25rem;
	}

	.row-actions,
	.cell-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
	}

	.hint {
		margin: 0.5rem 0 0;
		color: var(--muted);
		font-size: 0.72rem;
		line-height: 1.45;
	}

	.search {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		max-width: 30rem;
		margin: 1.75rem 0;
	}

	.data-table {
		width: 100%;
		margin-top: 1.5rem;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.data-table th {
		padding: 0.5rem 0.7rem;
		border-bottom: 1px solid var(--ink);
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-align: left;
		text-transform: uppercase;
	}

	.data-table td {
		padding: 0.8rem 0.7rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
		vertical-align: top;
	}

	.account-name {
		display: block;
		font-weight: 700;
	}

	.account-meta {
		display: block;
		margin-top: 0.2rem;
		color: var(--muted);
		font-size: 0.72rem;
		word-break: break-all;
	}

	.badge {
		display: inline-block;
		margin-left: 0.3rem;
		padding: 0.05rem 0.3rem;
		border: 1px solid var(--ink);
		color: var(--ink);
		font-size: 0.6rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.inline-form {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.inline-form select {
		width: auto;
		padding: 0.4rem 0.5rem;
		font-size: 0.75rem;
	}

	.storage-meter {
		width: 100%;
		min-width: 8.5rem;
		max-width: 12rem;
	}

	.meter-head {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.3rem;
	}

	.meter-label {
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.meter-value {
		color: var(--muted);
		font-size: 0.72rem;
		white-space: nowrap;
	}

	.meter-track {
		height: 0.5rem;
		border: 1px solid var(--ink);
		background: transparent;
	}

	.meter-fill {
		display: block;
		height: 100%;
		background: var(--accent);
	}

	.delete-wrap {
		position: relative;
	}

	.delete-panel {
		position: absolute;
		top: calc(100% + 0.4rem);
		right: 0;
		z-index: 20;
		display: grid;
		gap: 0.75rem;
		width: min(18rem, 70vw);
		padding: 0.9rem 1rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.delete-warn {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1.4;
	}

	.purge-check {
		display: flex;
		gap: 0.55rem;
		align-items: flex-start;
		margin: 0;
		font-size: 0.78rem;
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		line-height: 1.35;
		cursor: pointer;
	}

	.purge-check input {
		width: auto;
		margin-top: 0.15rem;
		accent-color: var(--accent);
	}

	.delete-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.pressable.danger {
		border-color: var(--ink);
		color: var(--ink);
		background: color-mix(in srgb, var(--accent) 28%, transparent);
	}

	.pressable.danger:not(.ghost) {
		color: var(--on-accent);
		background: var(--accent);
	}

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-weight: 700;
	}

	.empty {
		margin: 2rem 0 0;
		color: var(--muted);
		font-size: 0.88rem;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (max-width: 960px) {
		.data-table {
			display: block;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			mask-image: linear-gradient(to right, #000 85%, transparent);
		}
	}

	@media (max-width: 640px) {
		.page-head {
			margin-bottom: 1.25rem;
		}

		.intro {
			display: none;
		}
	}

	@media (pointer: coarse) {
		.pressable.small {
			min-height: var(--tap-min);
		}
	}
</style>
