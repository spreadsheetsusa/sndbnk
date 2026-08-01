import { Database } from 'bun:sqlite';

const USER_ID = process.argv[2];
const COUNT = Number(process.argv[3] ?? 120);
const db = new Database('local.db');

const donor = db
	.query(
		`select folder_key, audio_filename, audio_mime, audio_bytes, storage_adapter
		 from track where user_id = ? limit 1`
	)
	.get(USER_ID);

if (!donor) throw new Error('no existing track to borrow media from');

const peaks = JSON.stringify(
	Array.from({ length: 400 }, (_, i) => Math.round(30 + 50 * Math.abs(Math.sin(i / 7))))
);

const genres = ['Ambient', 'Techno', 'Jazz', 'Noise'];
const insert = db.query(
	`insert into track (
		id, user_id, title, artist, genre, duration_ms, waveform, published,
		audio_filename, audio_mime, audio_bytes, storage_adapter, folder_key, created_at, updated_at
	) values (?, ?, ?, 'Seed Artist', ?, 214000, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
);

db.query(`delete from track where id like 'seed-%'`).run();

const base = Date.now() - COUNT * 60_000;
for (let i = 0; i < COUNT; i++) {
	const at = base + i * 60_000;
	insert.run(
		`seed-${String(i).padStart(4, '0')}`,
		USER_ID,
		`Seeded Track ${String(COUNT - i).padStart(3, '0')}`,
		genres[i % genres.length],
		peaks,
		donor.audio_filename,
		donor.audio_mime,
		donor.audio_bytes,
		donor.storage_adapter,
		donor.folder_key,
		at,
		at
	);
}

console.log(`seeded ${COUNT} tracks for ${USER_ID}`);
