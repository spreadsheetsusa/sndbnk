import { relations } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
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

/** @typedef {'local' | 'ssh'} StorageAdapterId */

export const storageSetting = sqliteTable('storage_setting', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	adapter: text('adapter').notNull().default('local'),
	sshHost: text('ssh_host'),
	sshPort: integer('ssh_port').notNull().default(22),
	sshUsername: text('ssh_username'),
	sshRemotePath: text('ssh_remote_path'),
	sshPrivateKeyEnc: text('ssh_private_key_enc'),
	sshPassphraseEnc: text('ssh_passphrase_enc'),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date())
		.notNull()
});

export const track = sqliteTable('track', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description'),
	artist: text('artist'),
	album: text('album'),
	genre: text('genre'),
	year: integer('year'),
	trackNumber: integer('track_number'),
	bpm: integer('bpm'),
	isrc: text('isrc'),
	comment: text('comment'),
	audioFilename: text('audio_filename').notNull(),
	audioMime: text('audio_mime').notNull(),
	audioBytes: integer('audio_bytes').notNull(),
	coverFilename: text('cover_filename'),
	coverMime: text('cover_mime'),
	coverBytes: integer('cover_bytes'),
	durationMs: integer('duration_ms'),
	bitrate: integer('bitrate'),
	sampleRate: integer('sample_rate'),
	channels: integer('channels'),
	codec: text('codec'),
	/** JSON array of ~1000 peak ints (0-100) for waveform rendering. */
	waveform: text('waveform'),
	storageAdapter: text('storage_adapter').notNull().default('local'),
	folderKey: text('folder_key').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date())
		.notNull()
});

export const storageSettingRelations = relations(storageSetting, ({ one }) => ({
	user: one(user, {
		fields: [storageSetting.userId],
		references: [user.id]
	})
}));

export const trackRelations = relations(track, ({ one, many }) => ({
	user: one(user, {
		fields: [track.userId],
		references: [user.id]
	}),
	comments: many(trackComment),
	likes: many(trackLike)
}));

export const trackComment = sqliteTable(
	'track_comment',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		trackId: text('track_id')
			.notNull()
			.references(() => track.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		/** Playback position the comment was left at, if any. */
		atMs: integer('at_ms'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [index('track_comment_trackId_idx').on(table.trackId)]
);

export const trackCommentRelations = relations(trackComment, ({ one }) => ({
	track: one(track, {
		fields: [trackComment.trackId],
		references: [track.id]
	}),
	user: one(user, {
		fields: [trackComment.userId],
		references: [user.id]
	})
}));

export const trackLike = sqliteTable(
	'track_like',
	{
		trackId: text('track_id')
			.notNull()
			.references(() => track.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [primaryKey({ columns: [table.trackId, table.userId] })]
);

export const trackLikeRelations = relations(trackLike, ({ one }) => ({
	track: one(track, {
		fields: [trackLike.trackId],
		references: [track.id]
	}),
	user: one(user, {
		fields: [trackLike.userId],
		references: [user.id]
	})
}));

export * from './auth.schema';
