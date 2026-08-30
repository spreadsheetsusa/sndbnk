/**
 * Map a serialized list/detail track into the shape the global player needs.
 * Always forwards `audioUrl` / `coverUrl` so SSH public-base (and future
 * adapters) can skip the app proxy when the server provided absolute URLs.
 *
 * @param {{
 *   id: string,
 *   slug?: string | null,
 *   title: string,
 *   artist?: string | null,
 *   username?: string | null,
 *   uploaderName: string,
 *   mediaType?: string,
 *   durationMs?: number | null,
 *   bitrate?: number | null,
 *   sampleRate?: number | null,
 *   channels?: number | null,
 *   codec?: string | null,
 *   hasCover: boolean,
 *   audioUrl?: string | null,
 *   coverUrl?: string | null,
 *   waveform?: number[] | null,
 *   likedByViewer?: boolean,
 *   playCount?: number
 * }} track
 * @returns {import('#lib/player/player.svelte.js').PlayerTrack}
 */
export function toPlayerTrack(track) {
	return {
		id: track.id,
		slug: track.slug ?? null,
		title: track.title,
		artist: track.artist ?? null,
		username: track.username ?? null,
		uploaderName: track.uploaderName,
		mediaType: track.mediaType ?? 'track',
		durationMs: track.durationMs ?? null,
		bitrate: track.bitrate ?? null,
		sampleRate: track.sampleRate ?? null,
		channels: track.channels ?? null,
		codec: track.codec ?? null,
		hasCover: track.hasCover,
		audioUrl: track.audioUrl ?? null,
		coverUrl: track.coverUrl ?? null,
		waveform: track.waveform ?? null,
		likedByViewer: track.likedByViewer ?? false,
		playCount: track.playCount ?? 0
	};
}
