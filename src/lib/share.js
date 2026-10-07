import { formatDuration } from '#lib/media/audio-metadata.js';
import { absoluteUrl, musicRecordingJsonLd } from '#lib/seo.js';
import { ACCENTS, normalizeHex } from '#lib/stores/brand.js';
import { trackPath } from '#lib/track-path.js';

/**
 * Share metadata for a public track URL.
 *
 * Unfurlers do not run JavaScript. The track page therefore advertises:
 * - oEmbed discovery (WordPress, Discourse, Iframely, and similar)
 * - Open Graph audio (Mastodon and other fediverse clients play `og:audio`)
 * - a Discord component card (author line, cover, Play link)
 * Discord does not play page audio inline; the framed player is what oEmbed
 * consumers insert. X/Twitter player cards need a platform whitelist, so the
 * Twitter card stays a large image.
 */

/**
 * @param {string} origin
 * @param {string} pageUrl
 */
export function oembedDiscoveryUrl(origin, pageUrl) {
	const base = origin.replace(/\/$/, '');
	return `${base}/oembed?url=${encodeURIComponent(pageUrl)}&format=json`;
}

/**
 * @param {string} value
 */
function escapeDiscordMarkdown(value) {
	return String(value)
		.replace(/[\\*_`~|>#]/g, (char) => `\\${char}`)
		.replace(/@/g, '@\u200b')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * @param {string | null | undefined} hex
 */
function discordAccent(hex) {
	const normalized = normalizeHex(hex) ?? ACCENTS[0].value;
	return Number.parseInt(normalized.slice(1), 16);
}

/**
 * @param {{
 *   title: string,
 *   artist: string,
 *   durationLabel: string,
 *   pageUrl: string,
 *   coverUrl: string | null,
 *   accent: string | null | undefined
 * }} input
 * @returns {Record<string, unknown> | null}
 */
function discordTrackEmbed(input) {
	const title = escapeDiscordMarkdown(input.title).slice(0, 80);
	const artist = escapeDiscordMarkdown(input.artist).slice(0, 60);
	if (!title) return null;

	const detail = [artist, input.durationLabel].filter(Boolean).join(' · ');
	/** @type {Record<string, unknown>[]} */
	const text = [{ type: 10, content: detail ? `**${title}**\n${detail}` : `**${title}**` }];
	/** @type {Record<string, unknown>} */
	const section = { type: 9, components: text };
	if (input.coverUrl) {
		section.accessory = {
			type: 11,
			description: 'Cover art',
			media: { url: input.coverUrl }
		};
	}

	const payload = {
		component: {
			type: 17,
			accent_color: discordAccent(input.accent),
			components: [
				section,
				{
					type: 1,
					components: [{ type: 2, style: 5, label: 'Play', url: input.pageUrl }]
				}
			]
		}
	};

	// Discord drops the card above 3,000 bytes, and `<` is escaped before it is sent.
	if (JSON.stringify(payload).length > 2800) return null;
	return payload;
}

/**
 * @param {string | null | undefined} mime
 */
function imageMime(mime) {
	const value = mime?.trim().toLowerCase() ?? '';
	return value.startsWith('image/') ? value : null;
}

/**
 * @param {{
 *   origin: string,
 *   siteName?: string | null,
 *   onTenant?: boolean,
 *   track: {
 *     id: string,
 *     title: string,
 *     artist?: string | null,
 *     username?: string | null,
 *     uploaderName?: string | null,
 *     slug?: string | null,
 *     durationMs?: number | null,
 *     hasCover?: boolean,
 *     coverUrl?: string | null,
 *     audioUrl?: string | null,
 *     createdAt?: number | null,
 *     isPrivate?: boolean
 *   },
 *   description?: string | null,
 *   streamMime?: string | null,
 *   coverMime?: string | null,
 *   accent?: string | null,
 *   noindex?: boolean
 * }} input
 */
export function trackShareMeta(input) {
	const { origin, track } = input;
	const siteLabel = input.siteName?.trim() || 'SNDBNK';
	const artistName = track.artist || track.uploaderName || 'Unknown';
	const title = `${track.title} by ${artistName} | ${siteLabel}`;
	const description =
		input.description?.trim() || `Listen to ${track.title} by ${artistName} on ${siteLabel}.`;
	const canonical = `${origin.replace(/\/$/, '')}${trackPath(track)}`;
	const coverPath = track.hasCover ? track.coverUrl || `/api/media/${track.id}/cover` : null;
	const image = coverPath ? absoluteUrl(origin, coverPath) : null;
	const directAudio = track.audioUrl?.trim() ?? '';
	const audioUrl =
		input.streamMime && /^https?:\/\//i.test(directAudio)
			? directAudio
			: input.streamMime
				? absoluteUrl(origin, `/api/media/${track.id}/audio`)
				: null;
	const durationSec =
		track.durationMs != null && Number.isFinite(track.durationMs)
			? Math.max(0, Math.round(track.durationMs / 1000))
			: null;
	const durationLabel =
		track.durationMs != null && Number.isFinite(track.durationMs)
			? formatDuration(track.durationMs)
			: '';
	const musicianUrl = track.username
		? input.onTenant
			? `${origin.replace(/\/$/, '')}/`
			: `${origin.replace(/\/$/, '')}/users/${track.username}`
		: null;
	const publishedAt =
		track.createdAt != null && Number.isFinite(track.createdAt)
			? new Date(track.createdAt).toISOString()
			: null;

	return {
		title,
		description,
		canonical,
		image,
		imageType: image ? imageMime(input.coverMime) : null,
		siteName: input.siteName ?? null,
		noindex: Boolean(input.noindex || track.isPrivate),
		oembedUrl: oembedDiscoveryUrl(origin, canonical),
		publishedAt,
		audio: audioUrl
			? {
					url: audioUrl,
					mime: input.streamMime,
					durationSec,
					musicianUrl
				}
			: null,
		discordEmbed: discordTrackEmbed({
			title: track.title,
			artist: artistName,
			durationLabel: durationLabel === '—' ? '' : durationLabel,
			pageUrl: canonical,
			coverUrl: image,
			accent: input.accent
		}),
		jsonLd: musicRecordingJsonLd({
			name: track.title,
			byArtist: artistName,
			url: canonical,
			image,
			durationMs: track.durationMs,
			description,
			audioUrl,
			encodingFormat: input.streamMime,
			datePublished: publishedAt
		})
	};
}
