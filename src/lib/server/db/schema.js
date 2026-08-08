import { relations } from 'drizzle-orm';
import {
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';

export const task = sqliteTable('task', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

/** @typedef {'free' | 'vault' | 'studio' | 'label'} Plan */
/** @typedef {'none' | 'pending' | 'active'} CustomDomainStatus */
/** @typedef {'month' | 'year'} BillingInterval */
/** @typedef {'pending' | 'accepted'} AccountLinkStatus */

/**
 * Entitlements per tier, editable from the admin panel. Stripe owns the money
 * (Prices, Coupons, subscription state); this table owns the limits.
 */
export const plan = sqliteTable('plan', {
	id: text('id').primaryKey(),
	label: text('label').notNull(),
	blurb: text('blurb').notNull().default(''),
	/** JSON array of bullet strings shown on the pricing page. */
	features: text('features').notNull().default('[]'),
	/** Null means unlimited. */
	maxTracks: integer('max_tracks'),
	/** Null means unlimited. Only meters tracks stored on the `local` adapter. */
	maxLocalBytes: integer('max_local_bytes'),
	allowStorageAdapters: integer('allow_storage_adapters', { mode: 'boolean' })
		.notNull()
		.default(false),
	allowSubdomain: integer('allow_subdomain', { mode: 'boolean' }).notNull().default(false),
	allowCustomDomain: integer('allow_custom_domain', { mode: 'boolean' }).notNull().default(false),
	/** Studio+: allow hiding “Powered by SNDBNK” on tenant hosts. */
	allowRemoveBranding: integer('allow_remove_branding', { mode: 'boolean' })
		.notNull()
		.default(false),
	/** Label team seats; 0 means single-creator. Enforcement waits on teams UI. */
	maxTeamSeats: integer('max_team_seats').notNull().default(0),
	/** Display amounts in cents. Stripe remains the charging authority. */
	monthlyAmount: integer('monthly_amount').notNull().default(0),
	yearlyAmount: integer('yearly_amount').notNull().default(0),
	currency: text('currency').notNull().default('usd'),
	stripeProductId: text('stripe_product_id'),
	stripePriceMonthlyId: text('stripe_price_monthly_id'),
	stripePriceYearlyId: text('stripe_price_yearly_id'),
	sortOrder: integer('sort_order').notNull().default(0),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date())
		.notNull()
});

/** Processed webhook ids, so a Stripe redelivery is a no-op. */
export const stripeEvent = sqliteTable('stripe_event', {
	id: text('id').primaryKey(),
	type: text('type').notNull(),
	receivedAt: integer('received_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.notNull()
});

export const profile = sqliteTable('profile', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	username: text('username').notNull().unique(),
	plan: text('plan').notNull().default('free'),
	bio: text('bio'),
	location: text('location'),
	avatarFilename: text('avatar_filename'),
	avatarMime: text('avatar_mime'),
	customDomain: text('custom_domain').unique(),
	customDomainStatus: text('custom_domain_status').notNull().default('none'),
	domainVerifyToken: text('domain_verify_token'),
	customDomainVerifiedAt: integer('custom_domain_verified_at', { mode: 'timestamp_ms' }),
	stripeCustomerId: text('stripe_customer_id'),
	stripeSubscriptionId: text('stripe_subscription_id'),
	planInterval: text('plan_interval'),
	/** Stripe subscription status, or `grandfathered` for admin-comped paid accounts. */
	subscriptionStatus: text('subscription_status'),
	currentPeriodEnd: integer('current_period_end', { mode: 'timestamp_ms' }),
	cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date())
		.notNull()
});

/**
 * Per-creator tenant branding for subdomain / custom-domain hosts.
 * Lazy-created on first Settings → Site save; missing row means fall back to profile defaults.
 */
export const site = sqliteTable('site', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name'),
	description: text('description'),
	logoFilename: text('logo_filename'),
	logoMime: text('logo_mime'),
	/** `#RRGGBB`; null keeps the listener/default accent. */
	accentColor: text('accent_color'),
	hideBranding: integer('hide_branding', { mode: 'boolean' }).notNull().default(false),
	/** Custom-domain profile sidebar; ignored on subdomain/apex. Master off = hide all. */
	sidebarEnabled: integer('sidebar_enabled', { mode: 'boolean' }).notNull().default(false),
	sidebarStats: integer('sidebar_stats', { mode: 'boolean' }).notNull().default(true),
	sidebarFansAlsoLike: integer('sidebar_fans_also_like', { mode: 'boolean' })
		.notNull()
		.default(true),
	sidebarFollowers: integer('sidebar_followers', { mode: 'boolean' }).notNull().default(true),
	sidebarActivity: integer('sidebar_activity', { mode: 'boolean' }).notNull().default(true),
	ogImageFilename: text('og_image_filename'),
	ogImageMime: text('og_image_mime'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date())
		.notNull()
});

export const profileRelations = relations(profile, ({ one, many }) => ({
	user: one(user, {
		fields: [profile.userId],
		references: [user.id]
	}),
	links: many(profileLink),
	site: one(site, {
		fields: [profile.userId],
		references: [site.userId]
	})
}));

export const siteRelations = relations(site, ({ one }) => ({
	user: one(user, {
		fields: [site.userId],
		references: [user.id]
	}),
	profile: one(profile, {
		fields: [site.userId],
		references: [profile.userId]
	})
}));

export const profileLink = sqliteTable(
	'profile_link',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		label: text('label').notNull(),
		url: text('url').notNull(),
		position: integer('position').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [index('profile_link_userId_idx').on(table.userId)]
);

export const profileLinkRelations = relations(profileLink, ({ one }) => ({
	profile: one(profile, {
		fields: [profileLink.userId],
		references: [profile.userId]
	}),
	user: one(user, {
		fields: [profileLink.userId],
		references: [user.id]
	})
}));

/** @typedef {'local' | 'ssh'} StorageAdapterId */
/** @typedef {'track' | 'mix' | 'sample' | 'loop' | 'podcast'} TrackMediaType */

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

export const track = sqliteTable(
	'track',
	{
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
		/** Catalog kind: track | mix | sample | loop | podcast. */
		mediaType: text('media_type').notNull().default('track'),
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
		/** Encoder brand/tool, e.g. LAME3.97. */
		encoder: text('encoder'),
		/** Tag formats found, e.g. ID3v2.3. */
		tagTypes: text('tag_types'),
		/** ReplayGain / track gain offset in dB. */
		trackGainDb: real('track_gain_db'),
		/** Container label from probe, e.g. MPEG. */
		container: text('container'),
		/** JSON array of ~1000 peak ints (0-100) for waveform rendering. */
		waveform: text('waveform'),
		/** Denormalized listen count; incremented by recordTrackPlay. */
		playCount: integer('play_count').notNull().default(0),
		published: integer('published', { mode: 'boolean' }).notNull().default(true),
		storageAdapter: text('storage_adapter').notNull().default('local'),
		folderKey: text('folder_key').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.$onUpdate(() => new Date())
			.notNull()
	},
	// Composite (at, id) indexes to match the keyset pagination order exactly:
	// the feed walks all tracks, library and profiles walk one user's.
	(table) => [
		index('track_createdAt_id_idx').on(table.createdAt, table.id),
		index('track_userId_createdAt_idx').on(table.userId, table.createdAt, table.id)
	]
);

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
	likes: many(trackLike),
	reposts: many(trackRepost)
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

export const trackRepost = sqliteTable(
	'track_repost',
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
	(table) => [
		primaryKey({ columns: [table.trackId, table.userId] }),
		index('track_repost_userId_createdAt_idx').on(table.userId, table.createdAt, table.trackId)
	]
);

export const trackRepostRelations = relations(trackRepost, ({ one }) => ({
	track: one(track, {
		fields: [trackRepost.trackId],
		references: [track.id]
	}),
	user: one(user, {
		fields: [trackRepost.userId],
		references: [user.id]
	})
}));

export const follow = sqliteTable(
	'follow',
	{
		followerId: text('follower_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		followingId: text('following_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [
		primaryKey({ columns: [table.followerId, table.followingId] }),
		index('follow_followingId_idx').on(table.followingId)
	]
);

export const followRelations = relations(follow, ({ one }) => ({
	follower: one(user, {
		fields: [follow.followerId],
		references: [user.id],
		relationName: 'follower'
	}),
	following: one(user, {
		fields: [follow.followingId],
		references: [user.id],
		relationName: 'following'
	})
}));

/**
 * Mutual account linking for switching between moniker accounts.
 * Pending until the recipient accepts; accepted edges are trusted switches.
 */
export const accountLink = sqliteTable(
	'account_link',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		requesterId: text('requester_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		recipientId: text('recipient_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** @type {AccountLinkStatus} */
		status: text('status').notNull().default('pending'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.$onUpdate(() => new Date())
			.notNull(),
		acceptedAt: integer('accepted_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		uniqueIndex('account_link_requester_recipient_uidx').on(table.requesterId, table.recipientId),
		index('account_link_recipientId_idx').on(table.recipientId),
		index('account_link_requesterId_idx').on(table.requesterId)
	]
);

export const accountLinkRelations = relations(accountLink, ({ one }) => ({
	requester: one(user, {
		fields: [accountLink.requesterId],
		references: [user.id],
		relationName: 'accountLinkRequester'
	}),
	recipient: one(user, {
		fields: [accountLink.recipientId],
		references: [user.id],
		relationName: 'accountLinkRecipient'
	})
}));

export const playlist = sqliteTable(
	'playlist',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description'),
		published: integer('published', { mode: 'boolean' }).notNull().default(true),
		coverFilename: text('cover_filename'),
		coverMime: text('cover_mime'),
		coverBytes: integer('cover_bytes'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('playlist_createdAt_id_idx').on(table.createdAt, table.id),
		index('playlist_userId_createdAt_idx').on(table.userId, table.createdAt, table.id)
	]
);

export const playlistRelations = relations(playlist, ({ one, many }) => ({
	user: one(user, {
		fields: [playlist.userId],
		references: [user.id]
	}),
	tracks: many(playlistTrack),
	likes: many(playlistLike)
}));

export const playlistTrack = sqliteTable(
	'playlist_track',
	{
		playlistId: text('playlist_id')
			.notNull()
			.references(() => playlist.id, { onDelete: 'cascade' }),
		trackId: text('track_id')
			.notNull()
			.references(() => track.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [
		primaryKey({ columns: [table.playlistId, table.trackId] }),
		index('playlist_track_playlistId_position_idx').on(table.playlistId, table.position)
	]
);

export const playlistTrackRelations = relations(playlistTrack, ({ one }) => ({
	playlist: one(playlist, {
		fields: [playlistTrack.playlistId],
		references: [playlist.id]
	}),
	track: one(track, {
		fields: [playlistTrack.trackId],
		references: [track.id]
	})
}));

export const playlistLike = sqliteTable(
	'playlist_like',
	{
		playlistId: text('playlist_id')
			.notNull()
			.references(() => playlist.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [primaryKey({ columns: [table.playlistId, table.userId] })]
);

export const playlistLikeRelations = relations(playlistLike, ({ one }) => ({
	playlist: one(playlist, {
		fields: [playlistLike.playlistId],
		references: [playlist.id]
	}),
	user: one(user, {
		fields: [playlistLike.userId],
		references: [user.id]
	})
}));

/**
 * Per-user listening history. One row per (user, track); lastPlayedAt moves on
 * each counted play. Private to the listener — profile History tab is owner-only.
 */
export const listenHistory = sqliteTable(
	'listen_history',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		trackId: text('track_id')
			.notNull()
			.references(() => track.id, { onDelete: 'cascade' }),
		lastPlayedAt: integer('last_played_at', { mode: 'timestamp_ms' })
			.$defaultFn(() => new Date())
			.notNull(),
		playCount: integer('play_count').notNull().default(1)
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.trackId] }),
		index('listen_history_userId_lastPlayedAt_idx').on(
			table.userId,
			table.lastPlayedAt,
			table.trackId
		)
	]
);

export const listenHistoryRelations = relations(listenHistory, ({ one }) => ({
	user: one(user, {
		fields: [listenHistory.userId],
		references: [user.id]
	}),
	track: one(track, {
		fields: [listenHistory.trackId],
		references: [track.id]
	})
}));

/**
 * Singleton platform knobs (id = 'default'). Play thresholds are admin-editable.
 */
export const platformSettings = sqliteTable('platform_settings', {
	id: text('id').primaryKey().default('default'),
	/** Accumulated playing time as percent of duration (1–100) for non-mix media. */
	trackPlayPercent: integer('track_play_percent').notNull().default(60),
	/** Accumulated playing ms that counts as a play for mixes. */
	mixPlayContinualMs: integer('mix_play_continual_ms').notNull().default(600_000),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date())
		.notNull()
});

export * from './auth.schema';
