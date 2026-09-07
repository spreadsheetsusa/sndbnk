/**
 * Definite absence — do not retry (local miss, SFTP ENOENT, S3 NoSuchKey).
 * @param {unknown} err
 */
export function isMissingStorageObject(err) {
	if (!(err instanceof Error)) return false;
	if (err.message === 'File not found.') return true;

	const name = err.name;
	if (name === 'NoSuchKey' || name === 'NotFound') return true;

	const code = /** @type {{ code?: number | string, Code?: string }} */ (err).code;
	const awsCode = /** @type {{ Code?: string }} */ (err).Code;
	if (code === 2 || code === 'ENOENT' || code === 'NoSuchKey' || code === 'NotFound') return true;
	if (awsCode === 'NoSuchKey' || awsCode === 'NotFound') return true;

	const status = /** @type {{ $metadata?: { httpStatusCode?: number } }} */ (err).$metadata
		?.httpStatusCode;
	return status === 404;
}
