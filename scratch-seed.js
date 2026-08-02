import { Database } from 'bun:sqlite';
import { mkdir } from 'node:fs/promises';

const USER_ID = process.argv[2];
const db = new Database('local.db');
const now = Date.now();

db.query(
	`insert or replace into profile (user_id, username, plan, custom_domain_status, created_at, updated_at)
	 values (?, 'tagprobe', 'free', 'none', ?, ?)`
).run(USER_ID, now, now);

db.query(
	`insert or replace into storage_setting (user_id, adapter, ssh_port, updated_at) values (?, 'local', 22, ?)`
).run(USER_ID, now);

const fixtures = [
	{ id: 'probe-mp3', file: 'probe.mp3', name: 'audio.mp3', mime: 'audio/mpeg' },
	{ id: 'probe-flac', file: 'probe.flac', name: 'audio.flac', mime: 'audio/flac' }
];

for (const f of fixtures) {
	const src = Bun.file(`/tmp/sndbnk-tag/${f.file}`);
	const bytes = new Uint8Array(await src.arrayBuffer());
	const dir = `./media/${USER_ID}/${f.id}`;
	await mkdir(dir, { recursive: true });
	await Bun.write(`${dir}/${f.name}`, bytes);

	db.query(`delete from track where id = ?`).run(f.id);
	db.query(
		`insert into track (
			id, user_id, title, description, artist, album, genre, year, track_number, bpm, isrc, comment,
			audio_filename, audio_mime, audio_bytes, storage_adapter, folder_key, created_at, updated_at
		) values (?, ?, 'DB Title Should Not Win', 'DB description', 'DB Artist', 'DB Album', 'DB Genre',
			2011, 4, 128, 'USABC1234567', 'DB comment', ?, ?, ?, 'local', ?, ?, ?)`
	).run(f.id, USER_ID, f.name, f.mime, bytes.byteLength, f.id, now, now);

	console.log(`seeded ${f.id}: ${bytes.byteLength} bytes at ${dir}/${f.name}`);
}
