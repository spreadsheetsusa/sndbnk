/**
 * Scratch verification for the billing/plans/admin work. Drives the running dev server over HTTP
 * so the real hooks, loads, and actions run. Delete when the feature is signed off.
 *
 *   bun run dev            # in another terminal, on 5174
 *   bun scratch-billing-verify.js
 */
import { Database } from 'bun:sqlite';

const BASE = process.env.VERIFY_BASE ?? 'http://127.0.0.1:5174';
const db = new Database('local.db');

let cookie = '';

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function call(path, init = {}) {
	const res = await fetch(`${BASE}${path}`, {
		...init,
		redirect: 'manual',
		headers: {
			origin: BASE,
			...(cookie ? { cookie } : {}),
			...(init.headers ?? {})
		}
	});

	const setCookie = res.headers.getSetCookie?.() ?? [];
	for (const entry of setCookie) {
		const pair = entry.split(';')[0];
		if (pair.startsWith('sndbnk') || pair.includes('session')) {
			const name = pair.split('=')[0];
			const rest = cookie
				.split('; ')
				.filter((part) => part && !part.startsWith(`${name}=`))
				.join('; ');
			cookie = rest ? `${rest}; ${pair}` : pair;
		}
	}

	return res;
}

/**
 * @param {string} label
 * @param {boolean} pass
 * @param {string} [detail]
 */
function check(label, pass, detail = '') {
	console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
	if (!pass) process.exitCode = 1;
}

for (const stale of db.query("select user_id from profile where username like 'probe%'").all()) {
	db.run('delete from track where user_id = ?', [stale.user_id]);
	db.run('delete from profile where user_id = ?', [stale.user_id]);
	db.run('delete from session where user_id = ?', [stale.user_id]);
	db.run('delete from account where user_id = ?', [stale.user_id]);
	db.run('delete from user where id = ?', [stale.user_id]);
}

const stamp = Date.now().toString(36);
const username = `probe${stamp}`.slice(0, 20);
const email = `${username}@example.com`;

console.log(`\n== signup (${username}) ==`);
const signup = await call('/signup', {
	method: 'POST',
	body: new URLSearchParams({
		name: 'Quota Probe',
		username,
		email,
		password: 'correct-horse-battery',
		confirmPassword: 'correct-horse-battery'
	})
});
console.log('  status', signup.status, signup.headers.get('location') ?? '');

const row = db.query('select user_id, plan from profile where username = ?').get(username);
check('profile created on basic', row?.plan === 'basic', JSON.stringify(row));
check('session cookie captured', cookie.length > 0);

console.log('\n== signed-in surfaces ==');
for (const path of ['/plans', '/settings?tab=billing', '/library/new', '/admin']) {
	const res = await call(path);
	const body = await res.text();
	console.log(`  ${String(res.status).padEnd(4)} ${path}`);
	if (res.status >= 500) console.log(body.slice(0, 600));
}

console.log('\n== admin gating ==');
const asMember = await call('/admin');
check('non-admin is refused', asMember.status === 403, `got ${asMember.status}`);

db.run('update user set role = ? where id = ?', ['admin', row.user_id]);
const asAdmin = await call('/admin');
const adminBody = await asAdmin.text();
check('admin sees the panel', asAdmin.status === 200, `got ${asAdmin.status}`);
check(
	'plans section rendered',
	adminBody.includes('Not in Stripe') || adminBody.includes('In Stripe')
);
for (const section of ['plans', 'discounts', 'users']) {
	const res = await call(`/admin?section=${section}`);
	check(`section ${section} loads`, res.status === 200, `got ${res.status}`);
}
db.run('update user set role = null where id = ?', [row.user_id]);

console.log('\n== billing without Stripe keys ==');
const checkout = await call('/api/billing/checkout', {
	method: 'POST',
	headers: { 'content-type': 'application/json' },
	body: JSON.stringify({ planId: 'premium', interval: 'month' })
});
const checkoutBody = await checkout.json().catch(() => null);
check(
	'checkout reports a clear error, not a crash',
	checkout.status === 503 || checkout.status === 500,
	`${checkout.status} ${JSON.stringify(checkoutBody)}`
);

const hook = await call('/api/stripe/webhook', { method: 'POST', body: '{}' });
check(
	'webhook rejects an unsigned body',
	hook.status === 400 || hook.status === 503,
	`got ${hook.status} (503 is correct while STRIPE_WEBHOOK_SECRET is unset)`
);

console.log('\n== quota gate ==');
const now = Date.now();
const limit = db.query('select max_tracks from plan where id = ?').get('basic').max_tracks;
for (let index = 0; index < limit; index += 1) {
	const id = crypto.randomUUID();
	db.run(
		`insert into track (id, user_id, title, audio_filename, audio_mime, audio_bytes,
			storage_adapter, folder_key, published, created_at, updated_at)
		 values (?, ?, ?, ?, ?, ?, 'local', ?, 1, ?, ?)`,
		[id, row.user_id, `Filler ${index}`, 'audio.mp3', 'audio/mpeg', 1024, id, now, now]
	);
}
const filled = db
	.query('select count(*) as total from track where user_id = ?')
	.get(row.user_id).total;
check(`seeded ${limit} tracks`, filled === limit, `have ${filled}`);

const audio = Bun.file(process.argv[2] ?? '');
if (!(await audio.exists())) {
	console.log('  SKIP upload refusal — pass a path to an audio file as the first argument');
} else {
	const form = new FormData();
	form.set('title', 'Over the line');
	form.set('audio', audio, 'over-the-line.mp3');
	const upload = await call('/library/new', { method: 'POST', body: form });
	const uploadBody = await upload.text();
	const message = uploadBody.match(/Basic[^"<]*/)?.[0] ?? uploadBody.slice(0, 400);
	check('upload past the cap is refused', upload.status === 400, `${upload.status} ${message}`);
}

console.log('\n== storage adapter gate ==');
const sshForm = new URLSearchParams({
	adapter: 'ssh',
	sshHost: 'example.com',
	sshPort: '22',
	sshUsername: 'deploy',
	sshRemotePath: '/srv/audio',
	sshPrivateKey: 'not-a-real-key'
});
const onBasic = await call('/settings?/saveStorage', { method: 'POST', body: sshForm });
const basicBody = await onBasic.text();
check(
	'basic cannot select the SSH adapter',
	basicBody.includes('needs Premium or Business'),
	basicBody.slice(0, 200)
);

db.run('update profile set plan = ? where user_id = ?', ['premium', row.user_id]);
const onPremium = await call('/settings?/saveStorage', { method: 'POST', body: sshForm });
const premiumBody = await onPremium.text();
check(
	'premium gets past the plan gate',
	!premiumBody.includes('needs Premium or Business'),
	premiumBody.slice(0, 160)
);
db.run('update profile set plan = ? where user_id = ?', ['basic', row.user_id]);

console.log('\n== subdomain gate ==');
for (const [tier, expected] of [
	['basic', 302],
	['premium', 200]
]) {
	db.run('update profile set plan = ? where user_id = ?', [tier, row.user_id]);
	const res = await fetch(`${BASE}/`, {
		redirect: 'manual',
		headers: { host: `${username}.localhost:5174` }
	});
	check(
		`${tier} subdomain → ${expected}`,
		res.status === expected,
		`${res.status} ${res.headers.get('location') ?? ''}`
	);
}
db.run('update profile set plan = ? where user_id = ?', ['basic', row.user_id]);

console.log('\n== byte cap ==');
// The storage-adapter step above left this account on SSH; the cap only meters local bytes.
db.run("update storage_setting set adapter = 'local' where user_id = ?", [row.user_id]);
db.run('update plan set max_local_bytes = ? where id = ?', [4096, 'basic']);
// plans.js caches rows for 5s and this write bypasses invalidatePlanCache().
await Bun.sleep(5500);
db.run('delete from track where user_id = ?', [row.user_id]);
db.run(
	`insert into track (id, user_id, title, audio_filename, audio_mime, audio_bytes,
		storage_adapter, folder_key, published, created_at, updated_at)
	 values (?, ?, 'Bulky', 'audio.mp3', 'audio/mpeg', 4000, 'local', ?, 1, ?, ?)`,
	['cap-probe', row.user_id, 'cap-probe', now, now]
);
if (await audio.exists()) {
	const form = new FormData();
	form.set('title', 'Over the byte cap');
	form.set('audio', audio, 'over-the-cap.mp3');
	const capped = await call('/library/new', { method: 'POST', body: form });
	const cappedBody = await capped.text();
	check(
		'upload past the byte cap is refused',
		capped.status === 400 && /storage/i.test(cappedBody),
		`${capped.status} ${cappedBody}`
	);
}
db.run('update plan set max_local_bytes = null where id = ?', ['basic']);

console.log('\n== cleanup ==');
db.run('delete from track where user_id = ?', [row.user_id]);
db.run('delete from profile where user_id = ?', [row.user_id]);
db.run('delete from session where user_id = ?', [row.user_id]);
db.run('delete from account where user_id = ?', [row.user_id]);
db.run('delete from user where id = ?', [row.user_id]);
console.log(`  removed ${username}\n`);
