import { fail } from '@sveltejs/kit';
import { and, eq, inArray, ne } from 'drizzle-orm';

import { auth } from '#lib/server/auth';
import { removeAvatar, saveAvatar } from '#lib/server/avatar';
import { requestEmailChange } from '#lib/server/change-email';
import { db } from '#lib/server/db';
import { profile } from '#lib/server/db/schema';
import {
	createDomainVerifyToken,
	customDomainCandidates,
	isLikelyApexDomain,
	resolvePlatformAddresses,
	validateDomain,
	verifyCustomDomain
} from '#lib/server/domain-verify';
import {
	MAX_BIO_LENGTH,
	MAX_LOCATION_LENGTH,
	listLinksForUser,
	readLinkEntries,
	replaceLinksForUser,
	validateProfileLinks
} from '#lib/server/profile-links';
import { changeSubscription } from '#lib/server/billing/checkout';
import { canUseCustomDomain, getPlans, planOrDefault } from '#lib/server/billing/plans';
import { createPortalSession } from '#lib/server/billing/portal';
import { billingEnabled } from '#lib/server/billing/stripe';
import { getUsage } from '#lib/server/quota';
import { safeRedirect } from '#lib/server/safe-redirect';
import {
	STORAGE_ADAPTERS,
	getStorageSettingPublic,
	isEnabledAdapter,
	saveStorageSetting,
	testStorageConnection
} from '#lib/server/storage';
import { buildPublicUrls, getProfileByUserId } from '#lib/server/tenant';
import { validateUsername } from '#lib/server/username';
import { PUBLIC_BASE_DOMAIN } from '$app/env/public';

export const load = async ({ locals }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	const row = await getProfileByUserId(locals.user.id);
	if (!row) {
		safeRedirect(302, '/signup');
	}

	const urls = buildPublicUrls(row);
	const storage = await getStorageSettingPublic(locals.user.id);
	const links = await listLinksForUser(locals.user.id);
	const usage = await getUsage(locals.user.id);
	const tier = planOrDefault(row.plan);
	const platformAddresses = await resolvePlatformAddresses(urls.cnameTarget, PUBLIC_BASE_DOMAIN);

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email,
			image: locals.user.image ?? null
		},
		profile: {
			username: row.username,
			plan: row.plan,
			bio: row.bio ?? '',
			location: row.location ?? '',
			customDomain: row.customDomain,
			customDomainStatus: row.customDomainStatus,
			domainVerifyToken: row.domainVerifyToken
		},
		links,
		limits: {
			bio: MAX_BIO_LENGTH,
			location: MAX_LOCATION_LENGTH
		},
		urls,
		baseDomain: PUBLIC_BASE_DOMAIN,
		domainDns: {
			cnameTarget: urls.cnameTarget,
			platformAddresses,
			apexDomain: row.customDomain ? isLikelyApexDomain(row.customDomain) : false
		},
		billing: {
			enabled: billingEnabled,
			planId: tier.id,
			planLabel: tier.label,
			planBlurb: tier.blurb,
			interval: row.planInterval,
			status: row.subscriptionStatus,
			hasSubscription: Boolean(row.stripeSubscriptionId),
			cancelAtPeriodEnd: row.cancelAtPeriodEnd,
			currentPeriodEnd: row.currentPeriodEnd?.getTime() ?? null,
			monthlyAmount: tier.monthlyAmount,
			yearlyAmount: tier.yearlyAmount,
			allowStorageAdapters: tier.allowStorageAdapters,
			allowSubdomain: tier.allowSubdomain,
			allowCustomDomain: tier.allowCustomDomain
		},
		usage,
		plans: getPlans().map((option) => ({
			id: option.id,
			label: option.label,
			monthlyAmount: option.monthlyAmount,
			yearlyAmount: option.yearlyAmount,
			purchasable: Boolean(option.stripePriceMonthlyId && option.stripePriceYearlyId)
		})),
		storageAdapters: STORAGE_ADAPTERS,
		storage
	};
};

export const actions = {
	updateProfile: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const usernameRaw = formData.get('username')?.toString() ?? '';
		const bio = formData.get('bio')?.toString().trim() ?? '';
		const location = formData.get('location')?.toString().trim() ?? '';
		const linkEntries = readLinkEntries(formData);
		const usernameResult = validateUsername(usernameRaw);

		/** @param {string} message */
		const invalid = (message) => ({
			profileMessage: message,
			name,
			username: usernameRaw.trim(),
			bio,
			location,
			links: linkEntries
		});

		if (!name) {
			return fail(400, invalid('Name is required.'));
		}

		if (!usernameResult.ok) {
			return fail(400, invalid(usernameResult.message));
		}

		if (bio.length > MAX_BIO_LENGTH) {
			return fail(400, invalid(`Bio must be ${MAX_BIO_LENGTH} characters or fewer.`));
		}

		if (location.length > MAX_LOCATION_LENGTH) {
			return fail(400, invalid(`Location must be ${MAX_LOCATION_LENGTH} characters or fewer.`));
		}

		const linksResult = validateProfileLinks(linkEntries);
		if (!linksResult.ok) {
			return fail(400, invalid(linksResult.message));
		}

		const { username } = usernameResult;
		const taken = await db
			.select({ userId: profile.userId })
			.from(profile)
			.where(and(eq(profile.username, username), ne(profile.userId, locals.user.id)))
			.limit(1);

		if (taken.length > 0) {
			return fail(400, invalid('That username is already taken.'));
		}

		try {
			await auth.api.updateUser({
				body: { name },
				headers: request.headers
			});
		} catch {
			return fail(500, invalid('Could not update your name. Try again.'));
		}

		await db
			.update(profile)
			.set({
				username,
				bio: bio || null,
				location: location || null,
				updatedAt: new Date()
			})
			.where(eq(profile.userId, locals.user.id));

		await replaceLinksForUser(locals.user.id, linksResult.links);

		return { profileSuccess: 'Profile updated.' };
	},

	changeEmail: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const formData = await request.formData();
		const newEmail = formData.get('newEmail')?.toString() ?? '';
		const confirmEmail = formData.get('confirmEmail')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		const result = await requestEmailChange({
			currentEmail: locals.user.email,
			newEmailRaw: newEmail,
			confirmEmailRaw: confirmEmail,
			password,
			headers: request.headers
		});

		if (!result.ok) {
			return fail(400, { emailMessage: result.message, newEmail: result.newEmail });
		}

		return {
			emailSuccess: `Check ${result.newEmail} for a confirmation link. Your sign-in email stays the same until you click it.`
		};
	},

	uploadAvatar: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const formData = await request.formData();
		const file = formData.get('avatar');

		if (!(typeof File !== 'undefined' && file instanceof File && file.size > 0)) {
			return fail(400, { avatarMessage: 'Choose an image to upload.' });
		}

		const result = await saveAvatar(locals.user.id, file, request.headers);
		if (!result.ok) {
			return fail(400, { avatarMessage: result.message });
		}

		return { avatarSuccess: 'Avatar updated.' };
	},

	removeAvatar: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		await removeAvatar(locals.user.id, request.headers);

		return { avatarSuccess: 'Avatar removed.' };
	},

	openPortal: async ({ locals }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const result = await createPortalSession(locals.user.id);
		if (!result.ok) {
			return fail(400, { billingMessage: result.message });
		}

		safeRedirect(303, result.url);
	},

	changePlan: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const formData = await request.formData();
		const planId = formData.get('plan')?.toString() ?? '';
		const interval = formData.get('interval')?.toString() ?? '';

		const result = await changeSubscription(locals.user.id, planId, interval);
		if (!result.ok) {
			return fail(400, { billingMessage: result.message });
		}

		return {
			billingSuccess: `You're on ${planOrDefault(result.plan).label}. The difference is prorated on your next invoice.`
		};
	},

	saveDomain: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const row = await getProfileByUserId(locals.user.id);
		if (!row || !canUseCustomDomain(row.plan)) {
			return fail(403, {
				domainMessage: 'Custom domains need Studio or Label. Upgrade from the Billing tab.'
			});
		}

		const formData = await request.formData();
		const domainResult = validateDomain(formData.get('customDomain')?.toString() ?? '');

		if (!domainResult.ok) {
			return fail(400, {
				domainMessage: domainResult.message,
				customDomain: formData.get('customDomain')?.toString() ?? ''
			});
		}

		const { domain } = domainResult;

		if (domain === PUBLIC_BASE_DOMAIN || domain.endsWith(`.${PUBLIC_BASE_DOMAIN}`)) {
			return fail(400, {
				domainMessage: `Use your own domain — not ${PUBLIC_BASE_DOMAIN}.`,
				customDomain: domain
			});
		}

		const taken = await db
			.select({ userId: profile.userId, customDomain: profile.customDomain })
			.from(profile)
			.where(
				and(
					inArray(profile.customDomain, customDomainCandidates(domain)),
					ne(profile.userId, locals.user.id)
				)
			)
			.limit(1);

		if (taken.length > 0) {
			return fail(400, {
				domainMessage: 'That domain (or its www twin) is already connected to another account.',
				customDomain: domain
			});
		}

		const token =
			row.customDomain === domain && row.domainVerifyToken
				? row.domainVerifyToken
				: createDomainVerifyToken();

		await db
			.update(profile)
			.set({
				customDomain: domain,
				customDomainStatus: 'pending',
				domainVerifyToken: token,
				customDomainVerifiedAt: null,
				updatedAt: new Date()
			})
			.where(eq(profile.userId, locals.user.id));

		return {
			domainSuccess: 'Domain saved. Add the DNS records below, then verify.'
		};
	},

	verifyDomain: async ({ locals }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const row = await getProfileByUserId(locals.user.id);
		if (!row || !canUseCustomDomain(row.plan)) {
			return fail(403, {
				domainMessage: 'Custom domains need Studio or Label. Upgrade from the Billing tab.'
			});
		}

		if (!row.customDomain || !row.domainVerifyToken) {
			return fail(400, { domainMessage: 'Save a custom domain first.' });
		}

		const cnameTarget = `${row.username}.${PUBLIC_BASE_DOMAIN}`;

		try {
			const result = await verifyCustomDomain({
				domain: row.customDomain,
				token: row.domainVerifyToken,
				cnameTarget,
				baseDomain: PUBLIC_BASE_DOMAIN
			});

			if (!result.ok) {
				return fail(400, { domainMessage: result.message });
			}
		} catch {
			return fail(500, {
				domainMessage: 'DNS lookup failed. Check your records and try again in a minute.'
			});
		}

		await db
			.update(profile)
			.set({
				customDomainStatus: 'active',
				customDomainVerifiedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(profile.userId, locals.user.id));

		return { domainSuccess: 'Domain verified and active.' };
	},

	removeDomain: async ({ locals }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		await db
			.update(profile)
			.set({
				customDomain: null,
				customDomainStatus: 'none',
				domainVerifyToken: null,
				customDomainVerifiedAt: null,
				updatedAt: new Date()
			})
			.where(eq(profile.userId, locals.user.id));

		return { domainSuccess: 'Custom domain removed.' };
	},

	saveStorage: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const formData = await request.formData();
		const adapter = formData.get('adapter')?.toString() ?? '';
		const sshHost = formData.get('sshHost')?.toString() ?? '';
		const sshPort = formData.get('sshPort')?.toString() ?? '22';
		const sshUsername = formData.get('sshUsername')?.toString() ?? '';
		const sshRemotePath = formData.get('sshRemotePath')?.toString() ?? '';
		const sshPrivateKey = formData.get('sshPrivateKey')?.toString() ?? '';
		const sshPassphrase = formData.get('sshPassphrase')?.toString() ?? '';
		const clearPassphrase = formData.get('clearPassphrase')?.toString() === 'on';

		const result = await saveStorageSetting(locals.user.id, {
			adapter,
			sshHost,
			sshPort,
			sshUsername,
			sshRemotePath,
			sshPrivateKey,
			sshPassphrase,
			clearPassphrase
		});

		if (!result.ok) {
			return fail(400, {
				storageMessage: result.message,
				adapter,
				sshHost,
				sshPort,
				sshUsername,
				sshRemotePath
			});
		}

		return { storageSuccess: 'Storage settings saved.' };
	},

	testStorage: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const formData = await request.formData();
		const adapterRaw = formData.get('adapter')?.toString() ?? '';
		const adapter = isEnabledAdapter(adapterRaw) ? adapterRaw : undefined;

		const result = await testStorageConnection(locals.user.id, adapter);
		if (!result.ok) {
			return fail(400, { storageMessage: result.message });
		}

		return { storageSuccess: 'Connection OK.' };
	}
};
