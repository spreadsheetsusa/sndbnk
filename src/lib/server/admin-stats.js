import { stat, statfs } from 'node:fs/promises';
import { count, desc, eq, gte, sql } from 'drizzle-orm';

import { TRACK_MEDIA_TYPES } from '#lib/media/track-media-type.js';
import { DATABASE_URL, MEDIA_ROOT } from '#lib/server/app-env.js';
import { db } from '#lib/server/db/index.js';
import {
	follow,
	plan,
	playlist,
	playlistLike,
	profile,
	session,
	site,
	siteMedia,
	sitePage,
	track,
	trackComment,
	trackLike,
	trackRepost,
	user
} from '#lib/server/db/schema.js';
import { isPlatformS3Configured } from '#lib/server/storage/s3-config.js';

const DAY_MS = 86_400_000;

/** Legacy rows stored the upload size in `audio_bytes` and left `master_bytes` at 0. */
const masterBytesSql = sql`case when ${track.masterBytes} > 0 then ${track.masterBytes} else ${track.audioBytes} end`;

/** Playback bytes only when the derivative is a different object than the master. */
const playbackBytesSql = sql`case
	when ${track.playbackFilename} is not null
		and ${track.playbackFilename} != coalesce(nullif(${track.masterFilename}, ''), ${track.audioFilename})
	then coalesce(${track.playbackBytes}, 0)
	else 0
end`;

const coverBytesSql = sql`coalesce(${track.coverBytes}, 0)`;

/** Dual-written peak file. The DB JSON is ASCII, so character length matches the file. */
const waveformBytesSql = sql`coalesce(length(${track.waveform}), 0)`;

const trackFileBytesSql = sql`${masterBytesSql} + ${playbackBytesSql} + ${coverBytesSql} + ${waveformBytesSql}`;

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   tracks: number,
 *   bytes: number,
 *   configured?: boolean
 * }} StorageLocation
 *
 * @typedef {{
 *   capacityBytes: number,
 *   usedBytes: number,
 *   availableBytes: number,
 *   mediaBytes: number,
 *   databaseBytes: number
 * }} VolumeReading
 *
 * @typedef {{
 *   countedAt: number,
 *   platformBucket: boolean,
 *   users: {
 *     total: number,
 *     admins: number,
 *     banned: number,
 *     unverified: number,
 *     withoutProfile: number,
 *     signups7: number,
 *     signups30: number,
 *     sessions: number,
 *     signups: { day: string, count: number }[]
 *   },
 *   catalog: {
 *     tracks: number,
 *     published: number,
 *     drafts: number,
 *     privateTracks: number,
 *     plays: number,
 *     downloads: number,
 *     likes: number,
 *     comments: number,
 *     reposts: number,
 *     follows: number,
 *     playlists: number,
 *     playlistLikes: number,
 *     durationMs: number,
 *     missingDuration: number,
 *     playbackQueued: number,
 *     playbackFailed: number
 *   },
 *   media: {
 *     masters: number,
 *     playback: number,
 *     covers: number,
 *     waveforms: number,
 *     images: number,
 *     videos: number,
 *     imageFiles: number,
 *     videoFiles: number,
 *     byType: {
 *       id: string,
 *       tracks: number,
 *       durationMs: number,
 *       masters: number,
 *       playback: number,
 *       covers: number
 *     }[],
 *     byMime: { mime: string, files: number, bytes: number }[]
 *   },
 *   locations: StorageLocation[],
 *   plans: { id: string, label: string, accounts: number, tracks: number, hostedBytes: number }[],
 *   heavy: {
 *     username: string,
 *     name: string,
 *     plan: string,
 *     planLabel: string,
 *     tracks: number,
 *     hostedBytes: number,
 *     sshBytes: number
 *   }[],
 *   database: {
 *     fileBytes: number,
 *     walBytes: number,
 *     shmBytes: number,
 *     liveBytes: number,
 *     freeBytes: number,
 *     pageSize: number,
 *     pageCount: number,
 *     freelist: number
 *   },
 *   volumes: { server: VolumeReading | null, media: VolumeReading | null },
 *   sites: { total: number, pages: number, activeDomains: number, pendingDomains: number }
 * }} AdminSystemStats
 */

/**
 * Catalog, disk, and account totals for the admin system page.
 * Byte totals come from columns written at upload, not a live walk of object storage.
 * @returns {Promise<AdminSystemStats>}
 */
export async function getAdminSystemStats() {
	const now = Date.now();
	const todayUtc = utcMidnight(now);
	const signupStart = todayUtc - 13 * DAY_MS;
	const platformBucket = isPlatformS3Configured();

	const trackGroups = db
		.select({
			adapter: track.storageAdapter,
			mediaType: track.mediaType,
			tracks: count(),
			masters: sql`coalesce(sum(${masterBytesSql}), 0)`.mapWith(Number),
			playback: sql`coalesce(sum(${playbackBytesSql}), 0)`.mapWith(Number),
			covers: sql`coalesce(sum(${coverBytesSql}), 0)`.mapWith(Number),
			waveforms: sql`coalesce(sum(${waveformBytesSql}), 0)`.mapWith(Number),
			durationMs: sql`coalesce(sum(coalesce(${track.durationMs}, 0)), 0)`.mapWith(Number),
			plays: sql`coalesce(sum(${track.playCount}), 0)`.mapWith(Number),
			downloads: sql`coalesce(sum(${track.downloadCount}), 0)`.mapWith(Number),
			published: sql`coalesce(sum(case when ${track.published} = 1 then 1 else 0 end), 0)`.mapWith(
				Number
			),
			drafts: sql`coalesce(sum(case when ${track.published} = 0 then 1 else 0 end), 0)`.mapWith(
				Number
			),
			privateTracks:
				sql`coalesce(sum(case when ${track.published} = 1 and ${track.isPrivate} = 1 then 1 else 0 end), 0)`.mapWith(
					Number
				),
			playbackQueued:
				sql`coalesce(sum(case when ${track.playbackStatus} = 'queued' then 1 else 0 end), 0)`.mapWith(
					Number
				),
			playbackFailed:
				sql`coalesce(sum(case when ${track.playbackStatus} = 'failed' then 1 else 0 end), 0)`.mapWith(
					Number
				),
			missingDuration:
				sql`coalesce(sum(case when ${track.durationMs} is null or ${track.durationMs} = 0 then 1 else 0 end), 0)`.mapWith(
					Number
				)
		})
		.from(track)
		.groupBy(track.storageAdapter, track.mediaType)
		.all();

	const siteKinds = db
		.select({
			kind: siteMedia.kind,
			files: count(),
			bytes: sql`coalesce(sum(${siteMedia.bytes}), 0)`.mapWith(Number)
		})
		.from(siteMedia)
		.groupBy(siteMedia.kind)
		.all();

	const mimeRows = db
		.select({
			mime: sql`coalesce(nullif(${track.masterMime}, ''), ${track.audioMime})`.mapWith(String),
			files: count(),
			bytes: sql`coalesce(sum(${masterBytesSql}), 0)`.mapWith(Number)
		})
		.from(track)
		.groupBy(sql`coalesce(nullif(${track.masterMime}, ''), ${track.audioMime})`)
		.orderBy(desc(sql`coalesce(sum(${masterBytesSql}), 0)`))
		.limit(8)
		.all();

	const planRows = db
		.select({ id: plan.id, label: plan.label, sortOrder: plan.sortOrder })
		.from(plan)
		.orderBy(plan.sortOrder)
		.all();

	const planUsage = db
		.select({
			plan: profile.plan,
			accounts: sql`count(distinct ${profile.userId})`.mapWith(Number),
			tracks: sql`count(${track.id})`.mapWith(Number),
			hostedBytes: sql`coalesce(sum(case
				when ${track.storageAdapter} in ('local', 's3') then ${trackFileBytesSql}
				else 0
			end), 0)`.mapWith(Number)
		})
		.from(profile)
		.leftJoin(track, eq(track.userId, profile.userId))
		.groupBy(profile.plan)
		.all();

	const heavyRows = db
		.select({
			username: profile.username,
			name: user.name,
			plan: profile.plan,
			tracks: count(),
			hostedBytes: sql`coalesce(sum(case
				when ${track.storageAdapter} in ('local', 's3') then ${trackFileBytesSql}
				else 0
			end), 0)`.mapWith(Number),
			sshBytes:
				sql`coalesce(sum(case when ${track.storageAdapter} = 'ssh' then ${trackFileBytesSql} else 0 end), 0)`.mapWith(
					Number
				)
		})
		.from(track)
		.innerJoin(profile, eq(profile.userId, track.userId))
		.innerJoin(user, eq(user.id, track.userId))
		.groupBy(track.userId, profile.username, user.name, profile.plan)
		.orderBy(desc(sql`coalesce(sum(${trackFileBytesSql}), 0)`))
		.limit(8)
		.all();

	const signupRows = db
		.select({
			day: sql`strftime('%Y-%m-%d', ${user.createdAt} / 1000, 'unixepoch')`.mapWith(String),
			n: count()
		})
		.from(user)
		.where(gte(user.createdAt, new Date(signupStart)))
		.groupBy(sql`strftime('%Y-%m-%d', ${user.createdAt} / 1000, 'unixepoch')`)
		.all();

	const domainRows = db
		.select({
			status: profile.customDomainStatus,
			n: count()
		})
		.from(profile)
		.groupBy(profile.customDomainStatus)
		.all();

	const usersTotal = scalar(user);
	const profilesTotal = scalar(profile);
	const pages = readDatabasePages();
	const [fileBytes, walBytes, shmBytes, dbVolume, mediaVolume] = await Promise.all([
		fileSize(DATABASE_URL),
		fileSize(`${DATABASE_URL}-wal`),
		fileSize(`${DATABASE_URL}-shm`),
		readVolume(DATABASE_URL),
		readVolume(MEDIA_ROOT)
	]);

	const catalog = emptyCatalog();
	/** @type {Map<string, { tracks: number, masters: number, playback: number, covers: number, waveforms: number }>} */
	const byAdapter = new Map();
	/** @type {Map<string, { tracks: number, durationMs: number, masters: number, playback: number, covers: number }>} */
	const byType = new Map();

	for (const row of trackGroups) {
		const piece = {
			tracks: num(row.tracks),
			masters: num(row.masters),
			playback: num(row.playback),
			covers: num(row.covers),
			waveforms: num(row.waveforms),
			durationMs: num(row.durationMs),
			plays: num(row.plays),
			downloads: num(row.downloads),
			published: num(row.published),
			drafts: num(row.drafts),
			privateTracks: num(row.privateTracks),
			playbackQueued: num(row.playbackQueued),
			playbackFailed: num(row.playbackFailed),
			missingDuration: num(row.missingDuration)
		};
		catalog.tracks += piece.tracks;
		catalog.published += piece.published;
		catalog.drafts += piece.drafts;
		catalog.privateTracks += piece.privateTracks;
		catalog.plays += piece.plays;
		catalog.downloads += piece.downloads;
		catalog.durationMs += piece.durationMs;
		catalog.missingDuration += piece.missingDuration;
		catalog.playbackQueued += piece.playbackQueued;
		catalog.playbackFailed += piece.playbackFailed;

		const adapter = byAdapter.get(row.adapter) ?? emptyAdapter();
		adapter.tracks += piece.tracks;
		adapter.masters += piece.masters;
		adapter.playback += piece.playback;
		adapter.covers += piece.covers;
		adapter.waveforms += piece.waveforms;
		byAdapter.set(row.adapter, adapter);

		const type = byType.get(row.mediaType) ?? emptyType();
		type.tracks += piece.tracks;
		type.durationMs += piece.durationMs;
		type.masters += piece.masters;
		type.playback += piece.playback;
		type.covers += piece.covers;
		byType.set(row.mediaType, type);
	}

	catalog.likes = scalar(trackLike);
	catalog.comments = scalar(trackComment);
	catalog.reposts = scalar(trackRepost);
	catalog.follows = scalar(follow);
	catalog.playlists = scalar(playlist);
	catalog.playlistLikes = scalar(playlistLike);

	const imageRow = siteKinds.find((row) => row.kind === 'image');
	const videoRow = siteKinds.find((row) => row.kind === 'video');
	const images = num(imageRow?.bytes);
	const videos = num(videoRow?.bytes);
	const masters = sumAdapters(byAdapter, 'masters');
	const playback = sumAdapters(byAdapter, 'playback');
	const covers = sumAdapters(byAdapter, 'covers');
	const waveforms = sumAdapters(byAdapter, 'waveforms');

	const localFiles = adapterFileBytes(byAdapter.get('local'));
	const s3Files = adapterFileBytes(byAdapter.get('s3'));
	const sshFiles = adapterFileBytes(byAdapter.get('ssh'));
	const siteFiles = images + videos;
	const onDiskMedia = localFiles + (platformBucket ? 0 : siteFiles);

	const databaseBytes = fileBytes + walBytes + shmBytes || pages.liveBytes + pages.freeBytes;
	const sameVolume = Boolean(dbVolume && mediaVolume && dbVolume.dev === mediaVolume.dev);

	/** @type {VolumeReading | null} */
	let server = null;
	/** @type {VolumeReading | null} */
	let media = null;
	if (dbVolume && (!mediaVolume || sameVolume)) {
		server = volumeReading(dbVolume, onDiskMedia, databaseBytes);
	} else if (dbVolume && mediaVolume) {
		server = volumeReading(dbVolume, 0, databaseBytes);
		media = volumeReading(mediaVolume, onDiskMedia, 0);
	} else if (mediaVolume) {
		media = volumeReading(mediaVolume, onDiskMedia, 0);
	}

	const planLabel = new Map(planRows.map((row) => [row.id, row.label]));
	const usageByPlan = new Map(planUsage.map((row) => [row.plan, row]));
	const orderedPlanIds = [
		...planRows.map((row) => row.id),
		...planUsage.map((row) => row.plan).filter((id) => !planLabel.has(id))
	];

	const signupByDay = new Map(signupRows.map((row) => [row.day, num(row.n)]));
	const signups = Array.from({ length: 14 }, (_, index) => {
		const day = new Date(signupStart + index * DAY_MS).toISOString().slice(0, 10);
		return { day, count: signupByDay.get(day) ?? 0 };
	});

	const domainCount = (status) => num(domainRows.find((row) => row.status === status)?.n);

	/** @type {StorageLocation[]} */
	const locations = [
		{
			id: 'local',
			label: 'This server',
			tracks: byAdapter.get('local')?.tracks ?? 0,
			bytes: localFiles + (platformBucket ? 0 : siteFiles)
		},
		{
			id: 's3',
			label: 'Platform bucket',
			tracks: byAdapter.get('s3')?.tracks ?? 0,
			bytes: s3Files + (platformBucket ? siteFiles : 0),
			configured: platformBucket
		},
		{
			id: 'ssh',
			label: 'Creator servers',
			tracks: byAdapter.get('ssh')?.tracks ?? 0,
			bytes: sshFiles
		}
	];
	const r2 = byAdapter.get('r2');
	if (r2 && (r2.tracks > 0 || adapterFileBytes(r2) > 0)) {
		locations.push({
			id: 'r2',
			label: 'R2',
			tracks: r2.tracks,
			bytes: adapterFileBytes(r2)
		});
	}

	const knownTypes = new Set(/** @type {readonly string[]} */ (TRACK_MEDIA_TYPES));
	const typeOrder = [...TRACK_MEDIA_TYPES, ...byType.keys().filter((id) => !knownTypes.has(id))];

	return {
		countedAt: now,
		platformBucket,
		users: {
			total: usersTotal,
			admins: scalar(user, eq(user.role, 'admin')),
			banned: scalar(user, eq(user.banned, true)),
			unverified: scalar(user, eq(user.emailVerified, false)),
			withoutProfile: Math.max(0, usersTotal - profilesTotal),
			signups7: scalar(user, gte(user.createdAt, new Date(now - 7 * DAY_MS))),
			signups30: scalar(user, gte(user.createdAt, new Date(now - 30 * DAY_MS))),
			sessions: scalar(session, gte(session.expiresAt, new Date(now))),
			signups
		},
		catalog,
		media: {
			masters,
			playback,
			covers,
			waveforms,
			images,
			videos,
			imageFiles: num(imageRow?.files),
			videoFiles: num(videoRow?.files),
			byType: typeOrder
				.filter((id) => byType.has(id))
				.map((id) => {
					const row = byType.get(id) ?? emptyType();
					return { id, ...row };
				}),
			byMime: mimeRows.map((row) => ({
				mime: row.mime || 'unknown',
				files: num(row.files),
				bytes: num(row.bytes)
			}))
		},
		locations,
		plans: orderedPlanIds.map((id) => {
			const usage = usageByPlan.get(id);
			return {
				id,
				label: planLabel.get(id) ?? id,
				accounts: num(usage?.accounts),
				tracks: num(usage?.tracks),
				hostedBytes: num(usage?.hostedBytes)
			};
		}),
		heavy: heavyRows.map((row) => ({
			username: row.username,
			name: row.name,
			plan: row.plan,
			planLabel: planLabel.get(row.plan) ?? row.plan,
			tracks: num(row.tracks),
			hostedBytes: num(row.hostedBytes),
			sshBytes: num(row.sshBytes)
		})),
		database: {
			fileBytes,
			walBytes,
			shmBytes,
			liveBytes: pages.liveBytes,
			freeBytes: pages.freeBytes,
			pageSize: pages.pageSize,
			pageCount: pages.pageCount,
			freelist: pages.freelist
		},
		volumes: { server, media },
		sites: {
			total: scalar(site),
			pages: scalar(sitePage),
			activeDomains: domainCount('active'),
			pendingDomains: domainCount('pending')
		}
	};
}

/**
 * @param {number} now
 */
function utcMidnight(now) {
	const date = new Date(now);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * @param {unknown} value
 */
function num(value) {
	const n = Number(value ?? 0);
	return Number.isFinite(n) ? n : 0;
}

/**
 * @param {import('drizzle-orm/sqlite-core').SQLiteTable} table
 * @param {import('drizzle-orm').SQL | undefined} [where]
 */
function scalar(table, where) {
	const query = db.select({ n: count() }).from(table);
	const row = (where ? query.where(where) : query).get();
	return num(row?.n);
}

function readDatabasePages() {
	// Raw `db.get(sql)` returns a value tuple, not named columns.
	const row = /** @type {unknown[] | undefined} */ (
		db.get(sql`
			SELECT
				(SELECT page_count FROM pragma_page_count()),
				(SELECT page_size FROM pragma_page_size()),
				(SELECT freelist_count FROM pragma_freelist_count())
		`)
	);
	const pageCount = num(row?.[0]);
	const pageSize = num(row?.[1]);
	const freelist = num(row?.[2]);
	return {
		pageCount,
		pageSize,
		freelist,
		liveBytes: Math.max(0, pageCount - freelist) * pageSize,
		freeBytes: freelist * pageSize
	};
}

/**
 * @param {string} path
 */
async function fileSize(path) {
	try {
		return (await stat(path)).size;
	} catch {
		return 0;
	}
}

/**
 * @param {string} path
 * @returns {Promise<{ dev: string, capacityBytes: number, usedBytes: number, availableBytes: number } | null>}
 */
async function readVolume(path) {
	try {
		const [fileStat, fsStat] = await Promise.all([stat(path), statfs(path)]);
		const block = fsStat.bsize || 1;
		const capacityBytes = fsStat.blocks * block;
		const availableBytes = fsStat.bavail * block;
		return {
			dev: String(fileStat.dev),
			capacityBytes,
			availableBytes,
			usedBytes: Math.max(0, capacityBytes - availableBytes)
		};
	} catch {
		return null;
	}
}

/**
 * @param {{ capacityBytes: number, usedBytes: number, availableBytes: number }} volume
 * @param {number} mediaBytes
 * @param {number} databaseBytes
 * @returns {VolumeReading}
 */
function volumeReading(volume, mediaBytes, databaseBytes) {
	return {
		capacityBytes: volume.capacityBytes,
		usedBytes: volume.usedBytes,
		availableBytes: volume.availableBytes,
		mediaBytes,
		databaseBytes
	};
}

function emptyCatalog() {
	return {
		tracks: 0,
		published: 0,
		drafts: 0,
		privateTracks: 0,
		plays: 0,
		downloads: 0,
		likes: 0,
		comments: 0,
		reposts: 0,
		follows: 0,
		playlists: 0,
		playlistLikes: 0,
		durationMs: 0,
		missingDuration: 0,
		playbackQueued: 0,
		playbackFailed: 0
	};
}

function emptyAdapter() {
	return { tracks: 0, masters: 0, playback: 0, covers: 0, waveforms: 0 };
}

function emptyType() {
	return { tracks: 0, durationMs: 0, masters: 0, playback: 0, covers: 0 };
}

/**
 * @param {Map<string, { masters: number, playback: number, covers: number, waveforms: number }>} adapters
 * @param {'masters' | 'playback' | 'covers' | 'waveforms'} key
 */
function sumAdapters(adapters, key) {
	let total = 0;
	for (const row of adapters.values()) total += row[key];
	return total;
}

/**
 * @param {{ masters: number, playback: number, covers: number, waveforms: number } | undefined} row
 */
function adapterFileBytes(row) {
	if (!row) return 0;
	return row.masters + row.playback + row.covers + row.waveforms;
}
