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

/** @type {readonly { value: TrackMediaType, label: string }[]} */
export const TRACK_MEDIA_TYPE_OPTIONS = [
	{ value: 'track', label: 'Track' },
	{ value: 'mix', label: 'Mix' },
	{ value: 'sample', label: 'Sample' },
	{ value: 'loop', label: 'Loop' },
	{ value: 'podcast', label: 'Podcast' }
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
