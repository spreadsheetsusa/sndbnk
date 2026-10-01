/**
 * Magic-byte content sniffing for uploads. Client MIME/extension is a hint only.
 */

/**
 * @param {Uint8Array} bytes
 * @param {string} ascii
 */
function startsWithAscii(bytes, ascii) {
	if (bytes.length < ascii.length) return false;
	for (let i = 0; i < ascii.length; i++) {
		if (bytes[i] !== ascii.charCodeAt(i)) return false;
	}
	return true;
}

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {string} ascii
 */
function asciiAt(bytes, offset, ascii) {
	if (bytes.length < offset + ascii.length) return false;
	for (let i = 0; i < ascii.length; i++) {
		if (bytes[offset + i] !== ascii.charCodeAt(i)) return false;
	}
	return true;
}

/**
 * @param {Uint8Array} head
 * @returns {{ ext: string, mime: string } | null}
 */
export function sniffImage(head) {
	if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
		return { ext: 'jpg', mime: 'image/jpeg' };
	}
	if (
		head.length >= 8 &&
		head[0] === 0x89 &&
		head[1] === 0x50 &&
		head[2] === 0x4e &&
		head[3] === 0x47
	) {
		return { ext: 'png', mime: 'image/png' };
	}
	if (startsWithAscii(head, 'RIFF') && asciiAt(head, 8, 'WEBP')) {
		return { ext: 'webp', mime: 'image/webp' };
	}
	if (startsWithAscii(head, 'GIF87a') || startsWithAscii(head, 'GIF89a')) {
		return { ext: 'gif', mime: 'image/gif' };
	}
	return null;
}

/**
 * Design-library video. Rejects audio-only MP4 brands (m4a/m4b).
 * @param {Uint8Array} head
 * @returns {{ ext: string, mime: string } | null}
 */
export function sniffVideo(head) {
	if (
		head.length >= 4 &&
		head[0] === 0x1a &&
		head[1] === 0x45 &&
		head[2] === 0xdf &&
		head[3] === 0xa3
	) {
		return { ext: 'webm', mime: 'video/webm' };
	}
	if (!asciiAt(head, 4, 'ftyp') || head.length < 12) return null;
	const brand = String.fromCharCode(head[8], head[9], head[10], head[11]).toLowerCase();
	if (brand === 'm4a ' || brand === 'm4b ' || brand === 'm4p ') return null;
	if (brand === 'qt  ') return { ext: 'mov', mime: 'video/quicktime' };
	const video =
		brand === 'isom' ||
		brand === 'iso2' ||
		brand === 'mp41' ||
		brand === 'mp42' ||
		brand === 'avc1' ||
		brand === 'mp4v' ||
		brand === 'm4v ' ||
		brand.startsWith('mp4') ||
		brand.startsWith('avc');
	if (!video) return null;
	return { ext: 'mp4', mime: 'video/mp4' };
}

/**
 * @param {Uint8Array} head
 * @returns {{ ext: string, mime: string } | null}
 */
export function sniffAudio(head) {
	if (startsWithAscii(head, 'ID3')) {
		return { ext: 'mp3', mime: 'audio/mpeg' };
	}
	// MPEG frame sync
	if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0) {
		return { ext: 'mp3', mime: 'audio/mpeg' };
	}
	if (startsWithAscii(head, 'RIFF') && asciiAt(head, 8, 'WAVE')) {
		return { ext: 'wav', mime: 'audio/wav' };
	}
	// AIFF / AIFC: FORM....AIFF or FORM....AIFC
	if (startsWithAscii(head, 'FORM') && (asciiAt(head, 8, 'AIFF') || asciiAt(head, 8, 'AIFC'))) {
		return { ext: 'aiff', mime: 'audio/aiff' };
	}
	if (startsWithAscii(head, 'fLaC')) {
		return { ext: 'flac', mime: 'audio/flac' };
	}
	if (startsWithAscii(head, 'OggS')) {
		return { ext: 'ogg', mime: 'audio/ogg' };
	}
	// ISO BMFF (m4a/aac in mp4): size + 'ftyp' + brand
	if (asciiAt(head, 4, 'ftyp') && head.length >= 12) {
		const brand = String.fromCharCode(head[8], head[9], head[10], head[11]).toLowerCase();
		const m4aBrands = new Set(['m4a ', 'm4b ', 'mp42', 'isom', 'iso2', 'mp41', 'M4A ', 'MSNV']);
		if (m4aBrands.has(brand) || brand.startsWith('m4a') || brand.startsWith('mp4')) {
			return { ext: 'm4a', mime: 'audio/mp4' };
		}
		// Generic ftyp — still accept as m4a for common AAC uploads
		return { ext: 'm4a', mime: 'audio/mp4' };
	}
	// ADTS AAC
	if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xf6) === 0xf0) {
		return { ext: 'aac', mime: 'audio/aac' };
	}
	return null;
}

/**
 * Read the first bytes of a File/Blob for sniffing.
 * @param {Blob} file
 * @param {number} [n]
 */
export async function readFileHead(file, n = 32) {
	return new Uint8Array(await file.slice(0, n).arrayBuffer());
}
