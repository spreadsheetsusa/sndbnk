/**
 * @typedef {'local' | 'ssh' | 's3' | 'r2'} StorageAdapterKind
 */

/**
 * Inclusive byte range for `get`. Omit `end` to read through EOF.
 * `size` on the result is always the full object length.
 *
 * @typedef {{ start: number, end?: number }} StorageByteRange
 */

/**
 * @typedef {Object} StorageObject
 * @property {Uint8Array | ReadableStream | Blob} body
 * @property {string} contentType
 * @property {number} size
 */

/**
 * @typedef {Object} StorageAdapter
 * @property {StorageAdapterKind} id
 * @property {(folderKey: string, filename: string, data: Uint8Array | Blob, contentType: string) => Promise<void>} put
 * @property {(folderKey: string, filename: string, range?: StorageByteRange) => Promise<StorageObject>} get
 * @property {(folderKey: string) => Promise<void>} delete
 * @property {(folderKey: string, filename: string) => Promise<void>} deleteObject
 * @property {() => Promise<{ ok: true } | { ok: false, message: string }>} testConnection
 */

/**
 * @typedef {Object} StorageAdapterMeta
 * @property {StorageAdapterKind} id
 * @property {string} label
 * @property {string} description
 * @property {boolean} enabled
 */

export {};
