/**
 * Platform S3 config from process.env (app + workers + standalone scripts).
 * Kit also declares these in `src/env.js` so a missing optional var still boots.
 *
 * `S3_BUCKET` is the on-switch. Credentials are optional — when unset the AWS
 * SDK default chain is used (env `AWS_*`, shared config, instance role).
 */

/**
 * @typedef {Object} PlatformS3Config
 * @property {string} bucket
 * @property {string} region
 * @property {string} [accessKeyId]
 * @property {string} [secretAccessKey]
 * @property {string} [sessionToken]
 * @property {string} [endpoint]
 * @property {boolean} [forcePathStyle]
 */

/** @param {string} key */
function optional(key) {
	const value = process.env[key]?.trim();
	return value ? value : undefined;
}

/**
 * @returns {PlatformS3Config | null}
 */
export function getPlatformS3Config() {
	const bucket = optional('S3_BUCKET');
	if (!bucket) return null;

	const accessKeyId = optional('S3_ACCESS_KEY_ID');
	const secretAccessKey = optional('S3_SECRET_ACCESS_KEY');
	const sessionToken = optional('S3_SESSION_TOKEN');
	const endpoint = optional('S3_ENDPOINT');

	return {
		bucket,
		region: optional('S3_REGION') || 'us-east-1',
		...(accessKeyId ? { accessKeyId } : {}),
		...(secretAccessKey ? { secretAccessKey } : {}),
		...(sessionToken ? { sessionToken } : {}),
		...(endpoint ? { endpoint } : {}),
		forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'
	};
}

export function isPlatformS3Configured() {
	return getPlatformS3Config() !== null;
}

/**
 * Adapter id for new SNDBNK-hosted writes (not SSH BYOS).
 * @returns {'s3' | 'local'}
 */
export function platformAdapterId() {
	return isPlatformS3Configured() ? 's3' : 'local';
}
