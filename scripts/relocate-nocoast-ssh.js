/**
 * One-off: hardlink The Hermit's existing Dreamhost audio into the SSH adapter
 * folders, then upload only the small SNDBNK sidecars (cover, content images,
 * waveform JSON, playback MP3). Does not upload master audio.
 *
 *   bun ./scripts/relocate-nocoast-ssh.js --dry-run
 *   bun ./scripts/relocate-nocoast-ssh.js --link
 *   bun ./scripts/relocate-nocoast-ssh.js --sidecars
 */
import { appendFileSync, createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { Database } from 'bun:sqlite';
import { Client } from 'ssh2';

import { decryptSecret } from '../src/lib/server/storage/crypto.js';

const ACCOUNT_EMAIL = 'hiddenhermit@hotmail.com';
const SOURCE_DB = '/Users/bpk/Development/nocoastmuzik.com/.db/local.db';
const MAP_PATH = path.join(import.meta.dir, '.nocoast-import-map.json');
const MEDIA_ROOT = path.join(import.meta.dir, '..', 'media');
const MISS_PATH = '/tmp/nocoast-relocate-misses.json';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const doLink = args.has('--link') || (!args.has('--sidecars') && !dryRun);
const doSidecars = args.has('--sidecars');

const AUDIO_RE = /https?:\/\/[^\s'"<>]+\.(?:mp3|wav|m4a|flac|aiff|aif|ogg)(?:\?[^\s'"<>]*)?/gi;

/**
 * @param {string} value
 */
function sh(value) {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * @param {string} url
 */
function filenameOf(url) {
	let decoded = url;
	try {
		decoded = decodeURIComponent(url);
	} catch {
		// keep raw
	}
	const pathOnly = decoded.split('?')[0] ?? '';
	return { name: (pathOnly.split('/').pop() ?? '').toLowerCase(), pathOnly };
}

const local = new Database(path.join(import.meta.dir, '..', 'local.db'), { readonly: true });
const setting = local
	.query(
		`SELECT user_id AS userId, ssh_host AS host, ssh_port AS port, ssh_username AS username,
		        ssh_remote_path AS remotePath, ssh_private_key_enc AS keyEnc
		 FROM storage_setting WHERE user_id = (SELECT id FROM user WHERE email = ?)`
	)
	.get(ACCOUNT_EMAIL);
if (!setting?.keyEnc || !setting.remotePath) {
	console.error('SSH settings missing for', ACCOUNT_EMAIL);
	process.exit(1);
}
const privateKey = decryptSecret(setting.keyEnc);
const userId = setting.userId;
const remoteRoot = setting.remotePath.replace(/\/+$/, '');

/** @type {{ tracks: Record<string, string> }} */
const map = await Bun.file(MAP_PATH).json();

/** @type {Map<string, string>} */
const urlHint = new Map();
const source = new Database(SOURCE_DB, { readonly: true });
for (const row of source
	.query(`SELECT id, description, audio_file_url FROM media WHERE media_type = 'mix'`)
	.all()) {
	const html = `${row.description ?? ''}\n${row.audio_file_url ?? ''}`;
	AUDIO_RE.lastIndex = 0;
	for (const match of html.matchAll(AUDIO_RE)) {
		const { name, pathOnly } = filenameOf(match[0]);
		if (!name) continue;
		urlHint.set(`${row.id}|${name}`, pathOnly);
		urlHint.set(`${row.id}|${name.replace(/\+/g, ' ')}`, pathOnly);
	}
}
source.close();

/**
 * @typedef {{ trackId: string, masterFilename: string, masterBytes: number, sourceName: string, hint: string }} Job
 */

/** @type {Job[]} */
const jobs = [];
for (const [key, trackId] of Object.entries(map.tracks)) {
	const splitAt = key.indexOf('|');
	const sourceName = key.slice(splitAt + 1);
	const row = local
		.query(
			`SELECT master_filename AS masterFilename, master_bytes AS masterBytes
			 FROM track WHERE id = ? AND user_id = ?`
		)
		.get(trackId, userId);
	if (!row?.masterFilename) {
		console.error('missing track', trackId);
		continue;
	}
	jobs.push({
		trackId,
		masterFilename: row.masterFilename,
		masterBytes: row.masterBytes,
		sourceName,
		hint: urlHint.get(key) ?? urlHint.get(`${key.slice(0, splitAt)}|${sourceName}`) ?? ''
	});
}

/**
 * @param {import('ssh2').Client} client
 * @param {string} command
 * @param {string} [stdin]
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
/**
 * @param {import('ssh2').Client} client
 * @param {string} command
 * @param {string} [stdin]
 * @param {{ binary?: boolean }} [options]
 * @returns {Promise<{ code: number, stdout: string, stderr: string, stdoutBuf: Buffer }>}
 */
function exec(client, command, stdin = '', options = {}) {
	return new Promise((resolve, reject) => {
		client.exec(command, (err, stream) => {
			if (err) {
				reject(err);
				return;
			}
			/** @type {Buffer[]} */
			const out = [];
			/** @type {Buffer[]} */
			const errChunks = [];
			stream.on('data', (chunk) => out.push(Buffer.from(chunk)));
			stream.stderr.on('data', (chunk) => errChunks.push(Buffer.from(chunk)));
			stream.on('close', (code) => {
				const stdoutBuf = Buffer.concat(out);
				const stderr = Buffer.concat(errChunks).toString('utf8');
				resolve({
					code: code ?? 0,
					stdout: options.binary ? '' : stdoutBuf.toString('utf8'),
					stderr,
					stdoutBuf
				});
			});
			if (stdin) stream.write(stdin);
			stream.end();
		});
	});
}

/**
 * @param {import('ssh2').Client} client
 */
function sftp(client) {
	return new Promise((resolve, reject) => {
		client.sftp((err, session) => (err ? reject(err) : resolve(session)));
	});
}

const sidecarsOnly = doSidecars && !doLink && !dryRun;

if (!sidecarsOnly) {
const client = new Client();
await new Promise((resolve, reject) => {
	client
		.on('ready', resolve)
		.on('error', reject)
		.connect({
			host: setting.host,
			port: setting.port ?? 22,
			username: setting.username,
			privateKey,
			readyTimeout: 20000
		});
});

console.log(`Indexing ${setting.username}@${setting.host}:${remoteRoot}`);
const find = await exec(
	client,
	`find ${sh('/home/hermitshoard')} \\( -path ${sh(remoteRoot)} -o -path ${sh(`${remoteRoot}/*`)} \\) -prune -o -type f -printf '%s\\0%p\\0'`,
	'',
	{ binary: true }
);
if (find.code !== 0) {
	console.error(find.stderr || `find failed (${find.code})`);
	client.end();
	process.exit(1);
}

/** @type {Map<string, { path: string, size: number }[]>} */
const index = new Map();
const raw = find.stdoutBuf;
let offset = 0;
let files = 0;
while (offset < raw.length) {
	const sizeEnd = raw.indexOf(0, offset);
	if (sizeEnd < 0) break;
	const pathEnd = raw.indexOf(0, sizeEnd + 1);
	if (pathEnd < 0) break;
	const size = Number(raw.subarray(offset, sizeEnd).toString());
	const filePath = raw.subarray(sizeEnd + 1, pathEnd).toString();
	offset = pathEnd + 1;
	if (!filePath || !Number.isFinite(size)) continue;
	files += 1;
	const base = filePath.split('/').pop()?.toLowerCase() ?? '';
	if (!base) continue;
	const list = index.get(base);
	const item = { path: filePath, size };
	if (list) list.push(item);
	else index.set(base, [item]);
}
console.log(`Remote files ${files}, names ${index.size}, jobs ${jobs.length}`);

/**
 * @param {Job} job
 */
function chooseSource(job) {
	const spaced = job.sourceName.replace(/\+/g, ' ');
	const cands = index.get(job.sourceName) ?? index.get(spaced) ?? [];
	const sized = cands.filter((cand) => cand.size === job.masterBytes);
	if (sized.length === 0) return { file: null, reason: cands.length ? 'size' : 'missing', count: cands.length };
	if (sized.length === 1) return { file: sized[0], reason: 'size', count: 1 };
	const parts = job.hint.split('/').filter(Boolean);
	const dir = (parts.length >= 2 ? parts[parts.length - 2] : '').toLowerCase();
	const directed = dir ? sized.find((cand) => cand.path.toLowerCase().includes(`/${dir}/`)) : null;
	return { file: directed ?? sized[0], reason: directed ? 'dir' : 'size-multi', count: sized.length };
}

/** @type {{ trackId: string, sourceName: string, reason: string }[]} */
const misses = [];
/** @type {string[]} */
const commands = [];
let ready = 0;
for (const job of jobs) {
	const chosen = chooseSource(job);
	if (!chosen.file) {
		misses.push({ trackId: job.trackId, sourceName: job.sourceName, reason: chosen.reason });
		continue;
	}
	ready += 1;
	const destDir = `${remoteRoot}/${userId}/${job.trackId}`;
	const dest = `${destDir}/${job.masterFilename}`;
	commands.push(
		`mkdir -p ${sh(destDir)}\n` +
			`if [ -e ${sh(dest)} ]; then sz=$(stat -c %s ${sh(dest)}); ` +
			`if [ "$sz" = ${sh(String(job.masterBytes))} ]; then echo SKIP ${sh(job.trackId)}; ` +
			`else echo SIZE ${sh(job.trackId)}; fi; ` +
			`elif ln ${sh(chosen.file.path)} ${sh(dest)}; then echo OK ${sh(job.trackId)}; ` +
			`else echo FAIL ${sh(job.trackId)}; fi`
	);
}

console.log(`Linkable ${ready}, misses ${misses.length}`);
const byReason = {};
for (const miss of misses) byReason[miss.reason] = (byReason[miss.reason] ?? 0) + 1;
console.log('Miss reasons', byReason);
if (misses.length) {
	console.log('Sample misses:');
	for (const miss of misses.slice(0, 15)) console.log(`  ${miss.reason} ${miss.sourceName}`);
}

if (dryRun || !doLink) {
	await Bun.write(MISS_PATH, JSON.stringify(misses, null, 2));
	console.log(`Miss list ${MISS_PATH}`);
	if (!doSidecars) {
		client.end();
		process.exit(0);
	}
}

if (doLink && !dryRun) {
	console.log(`Linking ${commands.length} masters`);
	const script = `set +e\n${commands.join('\n')}\n`;
	const linked = await exec(client, 'bash -s', script);
	if (linked.stderr.trim()) console.error(linked.stderr.slice(0, 2000));
	const counts = { OK: 0, SKIP: 0, SIZE: 0, FAIL: 0 };
	for (const line of linked.stdout.split('\n')) {
		const kind = line.split(' ')[0];
		if (kind in counts) counts[kind] += 1;
	}
	console.log('Link results', counts, 'exit', linked.code);
	await Bun.write(MISS_PATH, JSON.stringify({ misses, counts }, null, 2));
}

if (!doSidecars) {
	client.end();
	process.exit(0);
}

client.end();
}

if (doSidecars && !dryRun) {
await uploadSidecars();
}

/**
 * @returns {Promise<import('ssh2').Client>}
 */
function connectClient() {
	const next = new Client();
	return new Promise((resolve, reject) => {
		next
			.on('ready', () => resolve(next))
			.on('error', reject)
			.connect({
				host: setting.host,
				port: setting.port ?? 22,
				username: setting.username,
				privateKey,
				readyTimeout: 20000
			});
	});
}

async function uploadSidecars() {
const opener = await connectClient();
const session = await sftp(opener);

/**
 * @param {string} remotePath
 * @returns {Promise<number | null>}
 */
function remoteSize(remotePath) {
	return new Promise((resolve) => {
		session.stat(remotePath, (err, stats) => {
			if (err) resolve(null);
			else resolve(stats.size);
		});
	});
}

/**
 * @param {string} dir
 */
function mkdirp(dir) {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(undefined), 15000);
		session.mkdir(dir, () => {
			clearTimeout(timer);
			resolve(undefined);
		});
	});
}

/**
 * @param {string} localPath
 * @param {string} remotePath
 */
function uploadFile(localPath, remotePath) {
	return new Promise((resolve, reject) => {
		const read = createReadStream(localPath);
		const write = session.createWriteStream(remotePath);
		read.on('error', reject);
		write.on('error', reject);
		write.on('close', () => resolve(undefined));
		read.pipe(write);
	});
}

	const localRoot = path.join(MEDIA_ROOT, userId);
	const userDir = `${remoteRoot}/${userId}`;
	/** @type {{ localPath: string, remotePath: string, size: number, dir: string }[]} */
	const files = [];
	for (const job of jobs) {
		const dir = path.join(localRoot, job.trackId);
		const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
		for (const entry of entries) {
			if (!entry.isFile() || entry.name.startsWith('master-')) continue;
			const localPath = path.join(dir, entry.name);
			files.push({
				localPath,
				remotePath: `${userDir}/${job.trackId}/${entry.name}`,
				size: Bun.file(localPath).size,
				dir: `${userDir}/${job.trackId}`
			});
		}
	}
	const note = (message) => {
		console.log(message);
		appendFileSync('/tmp/nocoast-sidecar-progress.txt', `${message}\n`);
	};
	note(`sidecar files ${files.length}`);
	await mkdirp(userDir);
	for (const dir of new Set(files.map((file) => file.dir))) await mkdirp(dir);

	let cursor = 0;
	let uploaded = 0;
	let skipped = 0;
	let failed = 0;

	/**
	 * @param {string} remotePath
	 * @returns {Promise<number | null>}
	 */
	function statSize(remotePath) {
		return new Promise((resolve) => {
			session.stat(remotePath, (err, stats) => resolve(err ? null : stats.size));
		});
	}

	/**
	 * @param {string} localPath
	 * @param {string} remotePath
	 */
	function putFile(localPath, remotePath) {
		return new Promise((resolve, reject) => {
			const read = createReadStream(localPath);
			const write = session.createWriteStream(remotePath);
			read.on('error', reject);
			write.on('error', reject);
			write.on('close', () => resolve(undefined));
			read.pipe(write);
		});
	}

	async function pump() {
		while (cursor < files.length) {
			const file = files[cursor];
			cursor += 1;
			const existing = await statSize(file.remotePath);
			if (existing === file.size) {
				skipped += 1;
			} else {
				try {
					await putFile(file.localPath, file.remotePath);
					uploaded += 1;
				} catch (err) {
					failed += 1;
					console.error(`${file.remotePath}: ${err instanceof Error ? err.message : err}`);
				}
			}
			const done = uploaded + skipped + failed;
			if (done % 50 === 0) {
				note(`sidecars uploaded ${uploaded} skipped ${skipped} failed ${failed}`);
			}
		}
	}

	// One SSH login. Dreamhost rejects extra sessions. A few writes share that channel.
	await Promise.all(Array.from({ length: 4 }, () => pump()));
	note(`Sidecars uploaded ${uploaded}, skipped ${skipped}, failed ${failed}`);
	opener.end();
}
