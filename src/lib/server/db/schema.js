import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';

export const task = sqliteTable('task', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

/** @typedef {'basic' | 'premium'} Plan */
/** @typedef {'none' | 'pending' | 'active'} CustomDomainStatus */

export const profile = sqliteTable('profile', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	username: text('username').notNull().unique(),
	plan: text('plan').notNull().default('basic'),
	customDomain: text('custom_domain').unique(),
	customDomainStatus: text('custom_domain_status').notNull().default('none'),
	domainVerifyToken: text('domain_verify_token'),
	customDomainVerifiedAt: integer('custom_domain_verified_at', { mode: 'timestamp_ms' }),
	stripeCustomerId: text('stripe_customer_id'),
	stripeSubscriptionId: text('stripe_subscription_id'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date())
		.notNull()
});

export const profileRelations = relations(profile, ({ one }) => ({
	user: one(user, {
		fields: [profile.userId],
		references: [user.id]
	})
}));

export * from './auth.schema';
