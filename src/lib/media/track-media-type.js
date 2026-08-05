/** @typedef {'track' | 'mix' | 'sample' | 'loop' | 'podcast'} TrackMediaType */

/** @type {readonly TrackMediaType[]} */
export const TRACK_MEDIA_TYPES = /** @type {const} */ ([
	'track',
	'mix',
	'sample',
	'loop',
	'podcast'
]);

/** @type {TrackMediaType} */
export const DEFAULT_TRACK_MEDIA_TYPE = 'track';

/** @type {readonly { value: TrackMediaType, label: string, plural: string }[]} */
export const TRACK_MEDIA_TYPE_OPTIONS = [
	{ value: 'track', label: 'Track', plural: 'Tracks' },
	{ value: 'mix', label: 'Mix', plural: 'Mixes' },
	{ value: 'sample', label: 'Sample', plural: 'Samples' },
	{ value: 'loop', label: 'Loop', plural: 'Loops' },
	{ value: 'podcast', label: 'Podcast', plural: 'Podcasts' }
];

/**
 * @param {unknown} value
 * @returns {value is TrackMediaType}
 */
export function isTrackMediaType(value) {
	return (
		typeof value === 'string' && TRACK_MEDIA_TYPES.includes(/** @type {TrackMediaType} */ (value))
	);
}
