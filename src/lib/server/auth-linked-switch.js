import { createAuthEndpoint } from '@better-auth/core/api';
import { APIError } from '@better-auth/core/error';
import { sessionMiddleware } from 'better-auth/api';
import { parseCookies, setSessionCookie } from 'better-auth/cookies';
import { z } from 'zod';

import { assertAcceptedLink } from '#lib/server/account-links';

const switchBodySchema = z.object({
	userId: z.string().min(1)
});

/**
 * Trusted switch between mutually linked accounts. Relies on the multi-session
 * plugin to keep prior sessions in `_multi-*` cookies so hop-back works.
 */
export function linkedAccountSwitch() {
	return {
		id: 'linked-account-switch',
		endpoints: {
			switchLinkedAccount: createAuthEndpoint(
				'/linked-account/switch',
				{
					method: 'POST',
					body: switchBodySchema,
					use: [sessionMiddleware],
					requireHeaders: true
				},
				async (ctx) => {
					const current = ctx.context.session;
					if (!current) throw APIError.fromStatus('UNAUTHORIZED');

					const targetUserId = ctx.body.userId;
					const link = await assertAcceptedLink(current.user.id, targetUserId);
					if (!link.ok) {
						throw APIError.fromStatus('FORBIDDEN', { message: link.message });
					}

					const targetUser = await ctx.context.internalAdapter.findUserById(targetUserId);
					if (!targetUser) {
						throw APIError.fromStatus('NOT_FOUND', { message: 'Account not found.' });
					}
					if (targetUser.banned) {
						throw APIError.fromStatus('FORBIDDEN', {
							message: 'That account cannot be used.'
						});
					}

					const sessionCookieConfig = ctx.context.authCookies.sessionToken;
					const currentMultiName = `${sessionCookieConfig.name}_multi-${current.session.token.toLowerCase()}`;
					const existingCurrentMulti = await ctx.getSignedCookie(
						currentMultiName,
						ctx.context.secret
					);
					if (!existingCurrentMulti) {
						await ctx.setSignedCookie(
							currentMultiName,
							current.session.token,
							ctx.context.secret,
							sessionCookieConfig.attributes
						);
					}

					const cookieHeader = ctx.headers?.get('cookie') || '';
					const cookies = Object.fromEntries(parseCookies(cookieHeader));
					const multiKeys = Object.keys(cookies).filter((key) => key.includes('_multi-'));

					for (const key of multiKeys) {
						const token = await ctx.getSignedCookie(key, ctx.context.secret);
						if (!token || typeof token !== 'string') continue;
						const found = await ctx.context.internalAdapter.findSession(token);
						if (found && found.session.expiresAt > new Date() && found.user.id === targetUserId) {
							await setSessionCookie(ctx, found);
							return ctx.json({
								session: found.session,
								user: found.user
							});
						}
					}

					const session = await ctx.context.internalAdapter.createSession(targetUserId);
					if (!session) {
						throw APIError.fromStatus('INTERNAL_SERVER_ERROR', {
							message: 'Could not create session.'
						});
					}

					await setSessionCookie(ctx, { session, user: targetUser });
					return ctx.json({ session, user: targetUser });
				}
			)
		}
	};
}
