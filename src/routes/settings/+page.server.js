import { fail } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';

import { auth } from '#lib/server/auth';
import { db } from '#lib/server/db';
import { profile } from '#lib/server/db/schema';
import {
	createDomainVerifyToken,
	validateDomain,
	verifyCustomDomain
} from '#lib/server/domain-verify';
import { PLAN_DETAILS, canUseCustomDomain, isPlan } from '#lib/server/plans';
import { safeRedirect } from '#lib/server/safe-redirect';
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

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email
		},
		profile: {
			username: row.username,
			plan: row.plan,
			customDomain: row.customDomain,
			customDomainStatus: row.customDomainStatus,
			domainVerifyToken: row.domainVerifyToken
		},
		urls,
		baseDomain: PUBLIC_BASE_DOMAIN,
		planDetails: PLAN_DETAILS
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
		const usernameResult = validateUsername(usernameRaw);

		if (!name) {
			return fail(400, {
				profileMessage: 'Name is required.',
				name,
				username: usernameRaw.trim()
			});
		}

		if (!usernameResult.ok) {
			return fail(400, {
				profileMessage: usernameResult.message,
				name,
				username: usernameRaw.trim()
			});
		}

		const { username } = usernameResult;
		const taken = await db
			.select({ userId: profile.userId })
			.from(profile)
			.where(and(eq(profile.username, username), ne(profile.userId, locals.user.id)))
			.limit(1);

		if (taken.length > 0) {
			return fail(400, {
				profileMessage: 'That username is already taken.',
				name,
				username
			});
		}

		try {
			await auth.api.updateUser({
				body: { name },
				headers: request.headers
			});
		} catch {
			return fail(500, {
				profileMessage: 'Could not update your name. Try again.',
				name,
				username
			});
		}

		await db
			.update(profile)
			.set({ username, updatedAt: new Date() })
			.where(eq(profile.userId, locals.user.id));

		return { profileSuccess: 'Profile updated.' };
	},

	setPlan: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const formData = await request.formData();
		const plan = formData.get('plan')?.toString() ?? '';

		if (!isPlan(plan)) {
			return fail(400, { planMessage: 'Choose Basic or Premium.' });
		}

		/** @type {Record<string, unknown>} */
		const patch = {
			plan,
			updatedAt: new Date()
		};

		if (plan === 'basic') {
			patch.customDomainStatus = 'none';
			patch.customDomainVerifiedAt = null;
			// Keep domain + token so upgrading again can re-verify quickly, but mark inactive.
		}

		await db.update(profile).set(patch).where(eq(profile.userId, locals.user.id));

		return {
			planSuccess:
				plan === 'premium'
					? 'Premium is on. Your subdomain is ready.'
					: 'Switched to Basic. Subdomain and custom domain are paused.'
		};
	},

	saveDomain: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const row = await getProfileByUserId(locals.user.id);
		if (!row || !canUseCustomDomain(row.plan)) {
			return fail(403, {
				domainMessage: 'Custom domains are a Premium feature. Switch plans first.'
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
			.select({ userId: profile.userId })
			.from(profile)
			.where(and(eq(profile.customDomain, domain), ne(profile.userId, locals.user.id)))
			.limit(1);

		if (taken.length > 0) {
			return fail(400, {
				domainMessage: 'That domain is already connected to another account.',
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
			return fail(403, { domainMessage: 'Custom domains are a Premium feature.' });
		}

		if (!row.customDomain || !row.domainVerifyToken) {
			return fail(400, { domainMessage: 'Save a custom domain first.' });
		}

		const cnameTarget = `${row.username}.${PUBLIC_BASE_DOMAIN}`;

		try {
			const result = await verifyCustomDomain({
				domain: row.customDomain,
				token: row.domainVerifyToken,
				cnameTarget
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
	}
};
