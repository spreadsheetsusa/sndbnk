import type { User, Session } from 'better-auth';

declare global {
	namespace App {
		interface Locals {
			/** `role` and the ban fields come from the better-auth admin plugin. */
			user?: User & { role?: string | null; banned?: boolean | null };
			session?: Session;
			/** Set when the request host is a premium tenant subdomain or custom domain. */
			tenant?: {
				userId: string;
				username: string;
				plan: string;
				name: string;
				customDomain: string | null;
				customDomainStatus: string;
				hostKind: 'subdomain' | 'custom';
			};
		}
	}
}

export {};
