import { normalizeGenreField } from '#lib/genres.js';

const COVER_MAX_BYTES = 5 * 1024 * 1024;

/** @type {Record<string, string>} */
const COVER_EXT_BY_MIME = {
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function asTrimmedString(value) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed || null;
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @returns {number | null}
 */
function clampInt(value, min, max) {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return null;
	const rounded = Math.round(n);
	if (rounded < min || rounded > max) return null;
	return rounded;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function commentText(value) {
	if (typeof value === 'string') return asTrimmedString(value);
	if (value && typeof value === 'object' && 'text' in value) {
		return asTrimmedString(/** @type {{ text?: unknown }} */ (value).text);
	}
	return null;
}

/**
 * @param {unknown} comments
 * @returns {string | null}
 */
function firstComment(comments) {
	if (!Array.isArray(comments) || comments.length === 0) return null;
	for (const entry of comments) {
		const text = commentText(entry);
		if (text) return text;
	}
	return null;
}

/**
 * @param {string} filename
 * @returns {string}
 */
function titleFromFilename(filename) {
	const base = filename.split(/[/\\]/).pop() ?? filename;
	const idx = base.lastIndexOf('.');
	return (idx > 0 ? base.slice(0, idx) : base).trim() || 'Untitled';
}

/**
 * @param {import('music-metadata').ICommonTagsResult} common
 * @returns {number | null}
 */
function resolveYear(common) {
	const direct = clampInt(common.year, 1000, 9999);
	if (direct != null) return direct;

	for (const candidate of [common.date, common.originaldate]) {
		const text = asTrimmedString(candidate);
		if (!text) continue;
		const match = text.match(/\b(1\d{3}|2\d{3})\b/);
		if (match) {
			const year = clampInt(match[1], 1000, 9999);
			if (year != null) return year;
		}
	}

	return null;
}

/**
 * @param {import('music-metadata').IPicture | undefined} picture
 * @returns {{ file: File } | { warning: string } | null}
 */
function pictureToCoverFile(picture) {
	if (!picture?.data?.length) return null;

	const mime = (picture.format || '').toLowerCase();
	const ext = COVER_EXT_BY_MIME[mime];
	if (!ext) {
		return {
			warning: 'Embedded cover art uses an unsupported format (use jpg, png, webp, or gif).'
		};
	}

	if (picture.data.byteLength > COVER_MAX_BYTES) {
		return { warning: 'Embedded cover art is larger than 5MB and was skipped.' };
	}

	const bytes = new Uint8Array(picture.data);
	const type = mime === 'image/jpg' ? 'image/jpeg' : mime;
	const file = new File([bytes], `cover.${ext}`, { type });

	return { file };
}

/**
 * Format duration milliseconds as m:ss or h:mm:ss.
 * @param {number | null | undefined} durationMs
 * @returns {string}
 */
export function formatDuration(durationMs) {
	if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) return '—';
	const totalSeconds = Math.round(durationMs / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const ss = String(seconds).padStart(2, '0');
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
	}
	return `${minutes}:${ss}`;
}

/**
 * Compact byte size for inspectors (matches hosted-storage meter style).
 * @param {number | null | undefined} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
	if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/**
 * @param {unknown} tagTypes
 * @returns {string | null}
 */
function resolveTagTypes(tagTypes) {
	if (!Array.isArray(tagTypes) || tagTypes.length === 0) return null;
	const labels = tagTypes.map((t) => asTrimmedString(t)).filter(Boolean);
	if (labels.length === 0) return null;
	const id3 = labels.find((t) => /^ID3/i.test(/** @type {string} */ (t)));
	return (id3 ?? labels.join(', ')).slice(0, 80);
}

/**
 * @param {import('music-metadata').IFormat} format
 * @param {import('music-metadata').ICommonTagsResult} common
 * @returns {number | null}
 */
function resolveTrackGainDb(format, common) {
	if (typeof format.trackGain === 'number' && Number.isFinite(format.trackGain)) {
		return format.trackGain;
	}
	const rg = common.replaygain_track_gain;
	if (rg && typeof rg.dB === 'number' && Number.isFinite(rg.dB)) return rg.dB;
	return null;
}

/**
 * Extract tag + format metadata from an audio File in the browser.
 * Never throws — parse failures return a warning and empty fields.
 *
 * @param {File} file
 * @returns {Promise<{
 *   fields: {
 *     title: string | null;
 *     description: string | null;
 *     artist: string | null;
 *     album: string | null;
 *     albumArtist: string | null;
 *     genre: string | null;
 *     year: string | null;
 *     trackNumber: string | null;
 *     discNumber: string | null;
 *     bpm: string | null;
 *     isrc: string | null;
 *     composer: string | null;
 *     comment: string | null;
 *   };
 *   technical: {
 *     durationMs: string | null;
 *     bitrate: string | null;
 *     sampleRate: string | null;
 *     channels: string | null;
 *     codec: string | null;
 *     encoder: string | null;
 *     tagTypes: string | null;
 *     trackGainDb: string | null;
 *     container: string | null;
 *   };
 *   cover: File | null;
 *   warning: string | null;
 *   autofilled: string[];
 * }>}
 */
export async function extractAudioMetadata(file) {
	/** @type {Awaited<ReturnType<typeof extractAudioMetadata>>} */
	const empty = {
		fields: {
			title: null,
			description: null,
			artist: null,
			album: null,
			albumArtist: null,
			genre: null,
			year: null,
			trackNumber: null,
			discNumber: null,
			bpm: null,
			isrc: null,
			composer: null,
			comment: null
		},
		technical: {
			durationMs: null,
			bitrate: null,
			sampleRate: null,
			channels: null,
			codec: null,
			encoder: null,
			tagTypes: null,
			trackGainDb: null,
			container: null
		},
		cover: null,
		warning: null,
		autofilled: []
	};

	try {
		const { parseBlob } = await import('music-metadata');
		const { common, format } = await parseBlob(file, { duration: true });

		const title = asTrimmedString(common.title) ?? titleFromFilename(file.name);
		const albumArtist = asTrimmedString(common.albumartist);
		const artist =
			asTrimmedString(common.artist) ?? albumArtist ?? asTrimmedString(common.artists?.[0]) ?? null;
		const album = asTrimmedString(common.album);
		const genre = normalizeGenreField(
			Array.isArray(common.genre) ? common.genre.join(', ') : common.genre
		);
		const year = resolveYear(common);
		const trackNumber = clampInt(common.track?.no, 1, 9999);
		const discNumber = clampInt(common.disk?.no, 1, 999);
		const bpm = clampInt(common.bpm, 1, 999);
		const isrc = asTrimmedString(common.isrc?.[0]);
		const composerJoined = Array.isArray(common.composer)
			? common.composer.filter((c) => typeof c === 'string' && c.trim()).join(', ')
			: common.composer;
		const composer = asTrimmedString(composerJoined)?.slice(0, 200) ?? null;
		const comment = firstComment(common.comment);
		// Some formats expose a free-text description; not all tag maps include it.
		const descriptionRaw = /** @type {{ description?: unknown }} */ (common).description;
		const description = firstComment(descriptionRaw) ?? asTrimmedString(descriptionRaw);

		const durationMs =
			format.duration != null && Number.isFinite(format.duration)
				? Math.round(format.duration * 1000)
				: null;
		const bitrate = clampInt(format.bitrate, 0, 10_000_000);
		const sampleRate = clampInt(format.sampleRate, 0, 768_000);
		const channels = clampInt(format.numberOfChannels, 1, 32);
		const codec = asTrimmedString(format.codec)?.slice(0, 40) ?? null;
		const encoder =
			asTrimmedString(format.tool)?.slice(0, 80) ??
			asTrimmedString(common.encodedby)?.slice(0, 80) ??
			null;
		const tagTypes = resolveTagTypes(format.tagTypes);
		const trackGainDb = resolveTrackGainDb(format, common);
		const container = asTrimmedString(format.container)?.slice(0, 80) ?? null;

		const pictureResult = pictureToCoverFile(common.picture?.[0]);
		/** @type {string | null} */
		let warning = null;
		/** @type {File | null} */
		let cover = null;
		if (pictureResult) {
			if ('file' in pictureResult) {
				cover = pictureResult.file;
			} else {
				warning = pictureResult.warning;
			}
		}

		const fields = {
			title,
			description,
			artist,
			album,
			albumArtist,
			genre,
			year: year != null ? String(year) : null,
			trackNumber: trackNumber != null ? String(trackNumber) : null,
			discNumber: discNumber != null ? String(discNumber) : null,
			bpm: bpm != null ? String(bpm) : null,
			isrc,
			composer,
			comment
		};

		/** @type {string[]} */
		const autofilled = [];
		for (const [key, value] of Object.entries(fields)) {
			if (value != null && value !== '') autofilled.push(key);
		}
		if (cover) autofilled.push('cover');

		return {
			fields,
			technical: {
				durationMs: durationMs != null ? String(durationMs) : null,
				bitrate: bitrate != null ? String(bitrate) : null,
				sampleRate: sampleRate != null ? String(sampleRate) : null,
				channels: channels != null ? String(channels) : null,
				codec,
				encoder,
				tagTypes,
				trackGainDb: trackGainDb != null ? String(trackGainDb) : null,
				container
			},
			cover,
			warning,
			autofilled
		};
	} catch (err) {
		return {
			...empty,
			fields: {
				...empty.fields,
				title: titleFromFilename(file.name)
			},
			autofilled: ['title'],
			warning:
				err instanceof Error
					? `Could not read metadata: ${err.message}`
					: 'Could not read metadata from this file.'
		};
	}
}
