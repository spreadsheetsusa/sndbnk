/**
 * One-off: copy nocoast mix posts onto thehermit's SNDBNK account as local files.
 *
 *   bun ./scripts/import-nocoast-mixes.js --dry-run
 *   bun ./scripts/import-nocoast-mixes.js --limit 1
 *   bun ./scripts/import-nocoast-mixes.js
 *
 * Reads the nocoast sqlite catalog, matches audio and images by filename under
 * backup-media, generates peaks and any playback MP3 on this machine, and writes
 * `storageAdapter: local` under MEDIA_ROOT. Does not follow the account's storage
 * setting and does not upload over SSH.
 *
 * Resume state: scripts/.nocoast-import-map.json (gitignored).
 */
import { mkdtemp, readdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Database } from 'bun:sqlite';
import { eq } from 'drizzle-orm';

import { slugifyTitle, uniqueSlug } from '../src/lib/slugify.js';
import { db } from '../src/lib/server/db/index.js';
import { playlist, playlistTrack, track, user } from '../src/lib/server/db/schema.js';
import {
	audioColumnsFromStream,
	createMediaRevision,
	isBrowserStreamableMaster,
	masterObjectName,
	playbackObjectName,
	sha256Hex,
	waveformObjectName
} from '../src/lib/server/media/assets.js';
import { sniffImage } from '../src/lib/server/media/sniff.js';
import { encodeToPlaybackMp3, PLAYBACK_MP3_MIME } from '../src/lib/server/media/transcode.js';
import { generateWaveformPeaksFromPath } from '../src/lib/server/media/waveform.js';
import { createLocalAdapter } from '../src/lib/server/storage/local.js';

const SOURCE_DB = '/Users/bpk/Development/nocoastmuzik.com/.db/local.db';
const BACKUP_MEDIA = '/Users/bpk/Development/nocoastmuzik.com/backup-media';
const ACCOUNT_EMAIL = 'hiddenhermit@hotmail.com';
const MAP_PATH = path.join(import.meta.dir, '.nocoast-import-map.json');

const CONTENT_MANIFEST = 'content.json';
const DESCRIPTION_MAX = 20_000;
const PLAYLIST_DESCRIPTION_MAX = 5_000;
const TITLE_MAX = 200;
const ARTIST_MAX = 200;
const GENRE_MAX = 200;
const COVER_MAX_BYTES = 5 * 1024 * 1024;
const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg', 'aiff', 'aif']);

/** @type {Record<string, string>} */
const AUDIO_MIME = {
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
	m4a: 'audio/mp4',
	flac: 'audio/flac',
	aac: 'audio/aac',
	ogg: 'audio/ogg',
	aiff: 'audio/aiff',
	aif: 'audio/aiff'
};

const AUDIO_RE = /https?:\/\/[^\s'"<>]+\.(?:mp3|wav|m4a|flac|aiff|aif|ogg)(?:\?[^\s'"<>]*)?/gi;
const IMG_RE = /(?:src|href)=['"]([^'"]+\.(?:jpe?g|png|gif|webp|bmp))['"]/gi;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitAt = args.indexOf('--limit');
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : Infinity;
if (limitAt >= 0 && (!Number.isInteger(limit) || limit < 1)) {
	console.error('--limit needs a positive number');
	process.exit(1);
}

/**
 * Source `created_at` is unix seconds, except a few broken values.
 * @param {unknown} raw
 */
function sourceDate(raw) {
	const n = Number(raw);
	if (!Number.isFinite(n)) return new Date();
	const ms = Math.abs(n) > 1e11 ? n : n * 1000;
	const date = new Date(ms);
	const year = date.getFullYear();
	if (year < 1990 || year > 2100) return new Date();
	return date;
}

/**
 * @param {string} value
 */
function decodeEntities(value) {
	return value
		.replace(/&#(\d+);/g, (_, n) => {
			const code = Number(n);
			return Number.isFinite(code) ? String.fromCodePoint(code) : _;
		})
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => {
			const code = Number.parseInt(n, 16);
			return Number.isFinite(code) ? String.fromCodePoint(code) : _;
		})
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'");
}

/**
 * @param {string} html
 */
function htmlToText(html) {
	const stripped = html
		.replace(
			/<a\b[^>]*href=['"][^'"]+\.(?:mp3|wav|m4a|flac|aiff|aif|ogg)[^'"]*['"][^>]*>[\s\S]*?<\/a>/gi,
			''
		)
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
		.replace(/<[^>]+>/g, '');
	return decodeEntities(stripped)
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/**
 * @param {string | null | undefined} url
 */
function filenameOf(url) {
	if (!url) return null;
	let decoded = url.trim();
	try {
		decoded = decodeURIComponent(decoded);
	} catch {
		// keep the raw name
	}
	const pathOnly = decoded.split('?')[0] ?? '';
	const name = pathOnly.split('/').pop() ?? '';
	return name || null;
}

/**
 * @param {string} filename
 */
function humanize(filename) {
	return filename
		.replace(/\.[^.]+$/, '')
		.replace(/[_+]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * @param {string} filename
 */
function artistFromFilename(filename) {
	const parts = humanize(filename).split(/\s+-\s+/);
	if (parts.length < 2) return null;
	const artist = parts[0]?.trim() ?? '';
	if (!artist || artist.length > ARTIST_MAX) return null;
	return artist;
}

/**
 * @param {string} filePath
 * @returns {Promise<number | null>}
 */
async function probeDurationMs(filePath) {
	const proc = Bun.spawn(
		[
			'ffprobe',
			'-v',
			'error',
			'-show_entries',
			'format=duration',
			'-of',
			'default=noprint_wrappers=1:nokey=1',
			filePath
		],
		{ stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' }
	);
	const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
	if (exitCode !== 0) return null;
	const seconds = Number.parseFloat(stdout.trim());
	if (!Number.isFinite(seconds) || seconds <= 0) return null;
	return Math.round(seconds * 1000);
}

/**
 * @param {string} inputPath
 * @param {string} outputPath
 */
async function convertImageToJpeg(inputPath, outputPath) {
	const proc = Bun.spawn(
		[
			'ffmpeg',
			'-y',
			'-v',
			'error',
			'-i',
			inputPath,
			'-frames:v',
			'1',
			'-vf',
			"scale='min(1600,iw)':-1",
			'-q:v',
			'3',
			outputPath
		],
		{ stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' }
	);
	const [stderr, exitCode] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
	if (exitCode !== 0) {
		throw new Error(stderr.trim() || `ffmpeg image convert failed (${exitCode})`);
	}
}

/**
 * @param {string} absPath
 * @returns {Promise<{ bytes: Uint8Array, ext: string, mime: string } | null>}
 */
async function prepareImage(absPath) {
	const file = Bun.file(absPath);
	if (!(await file.exists()) || file.size <= 0) return null;
	const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
	const sniffed = sniffImage(head);
	const ext = path.extname(absPath).slice(1).toLowerCase();
	if (sniffed && file.size <= COVER_MAX_BYTES && ext !== 'bmp') {
		return {
			bytes: new Uint8Array(await file.arrayBuffer()),
			ext: sniffed.ext,
			mime: sniffed.mime
		};
	}

	const dir = await mkdtemp(path.join(tmpdir(), 'nocoast-image-'));
	try {
		const out = path.join(dir, 'image.jpg');
		await convertImageToJpeg(absPath, out);
		const converted = Bun.file(out);
		if (!(await converted.exists()) || converted.size <= 0 || converted.size > COVER_MAX_BYTES) {
			return null;
		}
		return {
			bytes: new Uint8Array(await converted.arrayBuffer()),
			ext: 'jpg',
			mime: 'image/jpeg'
		};
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

/**
 * @param {string} root
 * @returns {Promise<Map<string, string[]>>}
 */
async function indexBackup(root) {
	/** @type {Map<string, string[]>} */
	const index = new Map();
	/** @param {string} dir */
	const walk = async (dir) => {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name.startsWith('.')) continue;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
				continue;
			}
			if (!entry.isFile()) continue;
			const key = entry.name.toLowerCase();
			const list = index.get(key);
			if (list) list.push(full);
			else index.set(key, [full]);
		}
	};
	await walk(root);
	return index;
}

/**
 * @param {Map<string, string[]>} index
 * @param {string} filename
 * @param {string} urlPath
 */
function pickPath(index, filename, urlPath) {
	const spaced = filename.replace(/\+/g, ' ').toLowerCase();
	const cands = index.get(filename.toLowerCase()) ?? index.get(spaced) ?? [];
	if (cands.length === 0) return null;
	if (cands.length === 1) return cands[0];
	const parts = urlPath.split('/').filter(Boolean);
	const dir = (parts.length >= 2 ? parts[parts.length - 2] : '').toLowerCase();
	if (!dir) return cands[0];
	return (
		cands.find((candidate) => candidate.toLowerCase().includes(`${path.sep}${dir}${path.sep}`)) ??
		cands[0]
	);
}

/**
 * @param {string} html
 * @param {string | null} audioUrl
 * @param {Map<string, string[]>} index
 */
function audioJobs(html, audioUrl, index) {
	/** @type {{ name: string, absPath: string }[]} */
	const jobs = [];
	const seen = new Set();
	/** @param {string | null | undefined} url */
	const add = (url) => {
		if (!url) return;
		let decoded = url;
		try {
			decoded = decodeURIComponent(url);
		} catch {
			// keep raw
		}
		const pathOnly = decoded.split('?')[0] ?? '';
		const name = pathOnly.split('/').pop() ?? '';
		if (!name) return;
		const ext = path.extname(name).slice(1).toLowerCase();
		if (!AUDIO_EXT.has(ext)) return;
		const key = name.replace(/\+/g, ' ').toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		const absPath = pickPath(index, name, pathOnly);
		jobs.push({ name, absPath: absPath ?? '' });
	};

	AUDIO_RE.lastIndex = 0;
	for (const match of html.matchAll(AUDIO_RE)) add(match[0]);
	if (!jobs.some((job) => job.absPath)) add(audioUrl);
	return jobs;
}

/**
 * @param {string} html
 * @param {string | null} coverUrl
 * @param {Map<string, string[]>} index
 */
function imagePaths(html, coverUrl, index) {
	/** @type {string[]} */
	const paths = [];
	const seen = new Set();
	/** @param {string | null | undefined} url */
	const add = (url) => {
		const name = filenameOf(url);
		if (!name) return;
		const key = name.replace(/\+/g, ' ').toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		let decoded = url ?? '';
		try {
			decoded = decodeURIComponent(decoded);
		} catch {
			// keep raw
		}
		const absPath = pickPath(index, name, decoded.split('?')[0] ?? '');
		if (!absPath) return;
		paths.push(absPath);
	};

	IMG_RE.lastIndex = 0;
	for (const match of html.matchAll(IMG_RE)) add(match[1]);
	add(coverUrl);
	return paths;
}

/**
 * @returns {Promise<{ tracks: Record<string, string>, playlists: Record<string, string> }>}
 */
async function loadMap() {
	const file = Bun.file(MAP_PATH);
	if (!(await file.exists())) return { tracks: {}, playlists: {} };
	const parsed = await file.json();
	return {
		tracks: parsed.tracks ?? {},
		playlists: parsed.playlists ?? {}
	};
}

/**
 * @param {{ tracks: Record<string, string>, playlists: Record<string, string> }} map
 */
async function saveMap(map) {
	const tmp = `${MAP_PATH}.tmp`;
	await Bun.write(tmp, JSON.stringify(map, null, 2));
	await rename(tmp, MAP_PATH);
}

const accountRows = await db
	.select({ id: user.id })
	.from(user)
	.where(eq(user.email, ACCOUNT_EMAIL))
	.limit(1);
const userId = accountRows[0]?.id;
if (!userId) {
	console.error(`No SNDBNK user for ${ACCOUNT_EMAIL}`);
	process.exit(1);
}

const source = new Database(SOURCE_DB, { readonly: true });
const mixes = source
	.query(
		`SELECT id, name, description, audio_file_url, cover_art_url, is_published, created_at
		 FROM media WHERE media_type = 'mix' ORDER BY created_at, id`
	)
	.all();

/** @type {Map<string, string[]>} */
const artistsByMedia = new Map();
for (const row of source
	.query(
		`SELECT a.media_id AS mediaId, COALESCE(NULLIF(u.name, ''), u.username) AS name
		 FROM artists_to_media a JOIN user u ON u.id = a.artist_id`
	)
	.all()) {
	const list = artistsByMedia.get(row.mediaId) ?? [];
	if (row.name) list.push(row.name);
	artistsByMedia.set(row.mediaId, list);
}

/** @type {Map<string, string[]>} */
const genresByMedia = new Map();
for (const row of source
	.query(
		`SELECT mg.media_id AS mediaId, g.name AS name
		 FROM media_genres mg JOIN genres g ON g.id = mg.genre_id`
	)
	.all()) {
	const list = genresByMedia.get(row.mediaId) ?? [];
	if (row.name) list.push(row.name);
	genresByMedia.set(row.mediaId, list);
}

console.log(`Indexing ${BACKUP_MEDIA}`);
const index = await indexBackup(BACKUP_MEDIA);

/**
 * @typedef {{
 *   key: string,
 *   mediaId: string,
 *   postTitle: string,
 *   title: string,
 *   artist: string | null,
 *   description: string,
 *   genre: string | null,
 *   published: boolean,
 *   createdAt: Date,
 *   audioPath: string,
 *   audioName: string,
 *   imagePaths: string[],
 *   playlist: boolean
 * }} Job
 */

/** @type {Job[]} */
const jobs = [];
/** @type {{ post: string, file: string }[]} */
const misses = [];
let playlistPosts = 0;
let matchedBytes = 0;
const countedAudio = new Set();

for (const mix of mixes) {
	const html = mix.description ?? '';
	const files = audioJobs(html, mix.audio_file_url, index);
	const matched = files.filter((file) => file.absPath);
	for (const file of files) {
		if (!file.absPath) misses.push({ post: mix.name, file: file.name });
	}
	if (matched.length === 0) continue;
	if (matched.length > 1) playlistPosts += 1;

	const text = htmlToText(html).slice(0, DESCRIPTION_MAX);
	const images = imagePaths(html, mix.cover_art_url, index);
	const linkedArtist = (artistsByMedia.get(mix.id) ?? []).join(', ').slice(0, ARTIST_MAX) || null;
	const genreList = genresByMedia.get(mix.id) ?? [];
	let genre = null;
	if (genreList.length > 0) {
		genre = genreList.join(', ');
		while (genre.length > GENRE_MAX && genre.includes(', ')) {
			genre = genre.slice(0, genre.lastIndexOf(', '));
		}
		if (genre.length > GENRE_MAX) genre = genre.slice(0, GENRE_MAX);
	}
	const createdAt = sourceDate(mix.created_at);
	const published = Number(mix.is_published) === 1;

	for (const file of matched) {
		if (!countedAudio.has(file.absPath)) {
			countedAudio.add(file.absPath);
			matchedBytes += Bun.file(file.absPath).size;
		}
		const multi = matched.length > 1;
		const title = (multi ? humanize(file.name) : mix.name.trim() || humanize(file.name)).slice(
			0,
			TITLE_MAX
		);
		jobs.push({
			key: `${mix.id}|${file.name.toLowerCase()}`,
			mediaId: mix.id,
			postTitle: mix.name.trim().slice(0, TITLE_MAX) || title,
			title,
			artist: multi ? artistFromFilename(file.name) : linkedArtist,
			description: text,
			genre,
			published,
			createdAt,
			audioPath: file.absPath,
			audioName: file.name,
			imagePaths: images,
			playlist: multi
		});
	}
}

console.log(
	[
		`posts ${mixes.length}`,
		`audio jobs ${jobs.length}`,
		`misses ${misses.length}`,
		`playlists ${playlistPosts}`,
		`unique audio ${countedAudio.size}`,
		`${(matchedBytes / 1024 ** 3).toFixed(2)} GiB`
	].join(' | ')
);
if (misses.length > 0) {
	console.log('Unmatched audio:');
	for (const miss of misses.slice(0, 30)) console.log(`  ${miss.post} — ${miss.file}`);
	if (misses.length > 30) console.log(`  … ${misses.length - 30} more`);
}

if (dryRun) {
	const first = jobs[0];
	if (first) {
		const mb = (Bun.file(first.audioPath).size / 1024 ** 2).toFixed(1);
		console.log(`First job: ${first.title} (${mb} MB, ${first.imagePaths.length} images)`);
	}
	source.close();
	process.exit(0);
}

if (!Bun.which('ffmpeg') || !Bun.which('ffprobe')) {
	console.error('ffmpeg and ffprobe are required');
	process.exit(1);
}

const storage = createLocalAdapter(userId);
const map = await loadMap();
const slugRows = await db.select({ slug: track.slug }).from(track).where(eq(track.userId, userId));
const takenSlugs = new Set(slugRows.map((row) => row.slug).filter(Boolean));

/**
 * @param {string} title
 */
function nextSlug(title) {
	const slug = uniqueSlug(slugifyTitle(title), takenSlugs);
	takenSlugs.add(slug);
	return slug;
}

/**
 * @param {Job} job
 * @param {Record<string, string>} trackIds
 */
async function ensurePlaylist(job, trackIds) {
	if (!job.playlist || map.playlists[job.mediaId]) return;
	const members = jobs.filter((item) => item.mediaId === job.mediaId);
	if (!members.every((item) => trackIds[item.key])) return;

	const id = crypto.randomUUID();
	const now = job.createdAt;
	await db.insert(playlist).values({
		id,
		userId,
		title: job.postTitle,
		description: job.description.slice(0, PLAYLIST_DESCRIPTION_MAX) || null,
		published: job.published,
		createdAt: now,
		updatedAt: now
	});
	let position = 0;
	for (const member of members) {
		await db.insert(playlistTrack).values({
			playlistId: id,
			trackId: trackIds[member.key],
			position,
			createdAt: now
		});
		position += 1;
	}
	map.playlists[job.mediaId] = id;
	await saveMap(map);
	console.log(`Playlist ${job.postTitle} (${members.length} mixes)`);
}

let imported = 0;
for (const job of jobs) {
	if (imported >= limit) break;
	if (map.tracks[job.key]) {
		await ensurePlaylist(job, map.tracks);
		continue;
	}

	const ext = path.extname(job.audioName).slice(1).toLowerCase() || 'mp3';
	const mime = AUDIO_MIME[ext] ?? 'application/octet-stream';
	const id = crypto.randomUUID();
	const revision = createMediaRevision();
	const masterFilename = masterObjectName(revision, ext === 'aif' ? 'aiff' : ext);
	const streamable = isBrowserStreamableMaster(mime, masterFilename);
	const started = Date.now();
	console.log(`Import ${job.title}`);

	const peaks = await generateWaveformPeaksFromPath(job.audioPath);
	/** @type {{ filename: string, mime: string, bytes: Uint8Array }[]} */
	const content = [];
	for (const imagePath of job.imagePaths) {
		const prepared = await prepareImage(imagePath);
		if (!prepared) continue;
		content.push({
			filename: `content-${content.length + 1}.${prepared.ext}`,
			mime: prepared.mime,
			bytes: prepared.bytes
		});
	}
	const cover = content[0] ?? null;
	const coverFilename = cover ? `cover.${cover.filename.split('.').pop()}` : null;

	/** @type {string | null} */
	let playbackPath = null;
	/** @type {string | null} */
	let playbackDir = null;
	if (!streamable) {
		playbackDir = await mkdtemp(path.join(tmpdir(), 'nocoast-playback-'));
		playbackPath = path.join(playbackDir, 'playback.mp3');
		const encoded = await encodeToPlaybackMp3(job.audioPath, playbackPath);
		if (!encoded.ok) {
			await rm(playbackDir, { recursive: true, force: true });
			console.error(`  playback encode failed: ${encoded.message}`);
			continue;
		}
	}

	const slug = nextSlug(job.title);
	let committed = false;
	try {
		const masterFile = Bun.file(job.audioPath);
		const masterBytes = new Uint8Array(await masterFile.arrayBuffer());
		const masterSha = sha256Hex(masterBytes);
		const durationMs = await probeDurationMs(job.audioPath);

		/** @type {{ filename: string, mime: string, bytes: number }} */
		let stream = { filename: masterFilename, mime, bytes: masterBytes.byteLength };
		/** @type {Uint8Array | null} */
		let playbackBytes = null;
		if (playbackPath) {
			playbackBytes = new Uint8Array(await Bun.file(playbackPath).arrayBuffer());
			stream = {
				filename: playbackObjectName(revision),
				mime: PLAYBACK_MP3_MIME,
				bytes: playbackBytes.byteLength
			};
		}

		const now = job.createdAt;
		await db.insert(track).values({
			id,
			userId,
			title: job.title,
			slug,
			description: job.description || null,
			artist: job.artist,
			genre: job.genre,
			mediaType: 'mix',
			mediaRevision: revision,
			masterFilename,
			masterMime: mime,
			masterBytes: masterBytes.byteLength,
			masterSha256: masterSha,
			playbackFilename: playbackBytes ? stream.filename : null,
			playbackMime: playbackBytes ? PLAYBACK_MP3_MIME : null,
			playbackBytes: playbackBytes ? playbackBytes.byteLength : null,
			playbackStatus: playbackBytes ? 'ready' : null,
			playbackError: null,
			playbackUpdatedAt: playbackBytes ? now : null,
			...audioColumnsFromStream(
				{ masterFilename, masterMime: mime, masterBytes: masterBytes.byteLength },
				stream
			),
			coverFilename,
			coverMime: cover?.mime ?? null,
			coverBytes: cover?.bytes.byteLength ?? null,
			durationMs,
			waveform: peaks ? JSON.stringify(peaks) : null,
			published: job.published,
			isPrivate: false,
			storageAdapter: 'local',
			folderKey: id,
			createdAt: now,
			updatedAt: now
		});

		await storage.put(id, masterFilename, masterBytes, mime);
		if (playbackBytes) {
			await storage.put(id, stream.filename, playbackBytes, PLAYBACK_MP3_MIME);
		}
		if (peaks) {
			await storage.put(
				id,
				waveformObjectName(revision),
				new TextEncoder().encode(JSON.stringify(peaks)),
				'application/json'
			);
		}
		if (cover && coverFilename) {
			await storage.put(id, coverFilename, cover.bytes, cover.mime);
		}
		for (const image of content) {
			await storage.put(id, image.filename, image.bytes, image.mime);
		}
		if (content.length > 0) {
			await storage.put(
				id,
				CONTENT_MANIFEST,
				new TextEncoder().encode(JSON.stringify(content.map((image) => image.filename))),
				'application/json'
			);
		}

		map.tracks[job.key] = id;
		await saveMap(map);
		committed = true;
		imported += 1;
		const seconds = ((Date.now() - started) / 1000).toFixed(1);
		console.log(`  ${id} in ${seconds}s  /thehermit/tracks/${slug}/`);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`  failed ${job.title}: ${message}`);
		if (!committed) {
			takenSlugs.delete(slug);
			try {
				await storage.delete(id);
			} catch {
				// folder may not exist yet
			}
			await db.delete(track).where(eq(track.id, id));
		}
	} finally {
		if (playbackDir) await rm(playbackDir, { recursive: true, force: true });
	}

	if (committed) {
		try {
			await ensurePlaylist(job, map.tracks);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`  playlist failed for ${job.postTitle}: ${message}`);
		}
	}
}

source.close();
console.log(`Done. Imported ${imported}.`);
