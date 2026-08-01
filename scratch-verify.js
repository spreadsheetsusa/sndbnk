import { Database } from 'bun:sqlite';
import { TagLib } from 'taglib-wasm';

const USER_ID = process.argv[2];
const db = new Database('local.db');
const taglib = await TagLib.initialize();

for (const id of ['probe-mp3', 'probe-flac']) {
	const row = db.query('select audio_filename, audio_bytes from track where id = ?').get(id);
	const path = `./media/${USER_ID}/${id}/${row.audio_filename}`;
	const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());

	const file = await taglib.open(bytes);
	const props = file.properties();
	file.dispose();

	console.log(`\n=== ${id}`);
	console.log('  on-disk bytes :', bytes.byteLength);
	console.log(
		'  db audio_bytes:',
		row.audio_bytes,
		bytes.byteLength === row.audio_bytes ? 'MATCH' : 'MISMATCH'
	);
	console.log(
		'  title         :',
		JSON.stringify(props.title),
		'<- must still be "Original Title"'
	);
	for (const k of ['artist', 'album', 'genre', 'date', 'trackNumber', 'bpm', 'isrc', 'comment']) {
		console.log(`  ${k.padEnd(14)}:`, JSON.stringify(props[k]));
	}
	console.log('  DESCRIPTION   :', JSON.stringify(props.DESCRIPTION));
}
