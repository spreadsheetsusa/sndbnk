import path from 'node:path';

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * @param {string} value
 * @param {string} label
 */
export function assertSafeStorageSegment(value, label) {
	if (!value || value === '.' || value === '..' || !SAFE_SEGMENT.test(value)) {
		throw new Error(`Invalid ${label}.`);
	}
}

/**
 * Resolve parts under root and ensure the result cannot escape.
 * @param {string} root
 * @param {...string} parts
 */
export function assertSafeStoragePath(root, ...parts) {
	for (const part of parts) {
		assertSafeStorageSegment(part, 'storage path segment');
	}
	const resolvedRoot = path.resolve(root);
	const resolved = path.resolve(root, ...parts);
	if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
		throw new Error('Invalid storage path.');
	}
	return resolved;
}
