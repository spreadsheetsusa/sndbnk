/**
 * Bootstrap a staff admin (better-auth `role = 'admin'`) with a profile row.
 *
 * Interactive (Django-style):
 *   bun run createsuperuser
 *
 * Non-interactive (CI / SSH):
 *   bun run createsuperuser -- --email you@sndbnk.com --username ben --password '…' --name 'Ben'
 *
 * If the email already exists, the account is promoted to admin (password unchanged
 * unless `--password` is also passed). Username must match an existing profile or
 * be free to claim.
 */
import { Database } from 'bun:sqlite';
import { createInterface } from 'node:readline';
import { hashPassword } from 'better-auth/crypto';

import { validateUsername } from '../src/lib/server/username.js';

const MIN_PASSWORD_LENGTH = 8;

const dbPath = process.env.DATABASE_URL?.trim();
if (!dbPath) throw new Error('DATABASE_URL is not set');

const args = parseArgs(process.argv.slice(2));
const db = new Database(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

const email = (args.email ?? (await ask('Email: '))).trim().toLowerCase();
const usernameRaw = args.username ?? (await ask('Username: '));
const name = (args.name ?? (await ask('Display name: '))).trim();
const password = await resolvePassword(args);

if (!email || !email.includes('@')) die('Enter a valid email address.');
if (!name) die('Enter a display name.');

const usernameResult = validateUsername(usernameRaw);
if (!usernameResult.ok) die(usernameResult.message);
const { username } = usernameResult;

if (password.length < MIN_PASSWORD_LENGTH) {
	die(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
}

const existingUser = db.query(`SELECT id, email, role FROM user WHERE email = ?`).get(email);
const existingProfile = db
	.query(`SELECT user_id, username FROM profile WHERE username = ?`)
	.get(username);

if (existingProfile && (!existingUser || existingProfile.user_id !== existingUser.id)) {
	die(`Username @${username} is already taken.`);
}

const now = Date.now();

if (existingUser) {
	db.run(
		`UPDATE user SET role = 'admin', name = ?, email_verified = 1, updated_at = ? WHERE id = ?`,
		[name, now, existingUser.id]
	);

	if (args.password) {
		const hashed = await hashPassword(password);
		const account = db
			.query(`SELECT id FROM account WHERE user_id = ? AND provider_id = 'credential'`)
			.get(existingUser.id);
		if (account) {
			db.run(`UPDATE account SET password = ?, updated_at = ? WHERE id = ?`, [
				hashed,
				now,
				account.id
			]);
		} else {
			db.run(
				`INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
				 VALUES (?, ?, 'credential', ?, ?, ?, ?)`,
				[crypto.randomUUID(), existingUser.id, existingUser.id, hashed, now, now]
			);
		}
	}

	if (!existingProfile) {
		insertProfile(existingUser.id, username, now);
	}

	console.log(
		`Promoted ${email} to admin${args.password ? ' (password updated)' : ''}. Sign in and open /admin.`
	);
	process.exit(0);
}

const userId = crypto.randomUUID();
const hashed = await hashPassword(password);

db.run(
	`INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at, role, banned)
	 VALUES (?, ?, ?, 1, NULL, ?, ?, 'admin', 0)`,
	[userId, name, email, now, now]
);

db.run(
	`INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
	 VALUES (?, ?, 'credential', ?, ?, ?, ?)`,
	[crypto.randomUUID(), userId, userId, hashed, now, now]
);

insertProfile(userId, username, now);

console.log(`Created admin @${username} <${email}>. Sign in and open /admin.`);

/**
 * @param {string} userId
 * @param {string} username
 * @param {number} now
 */
function insertProfile(userId, username, now) {
	db.run(
		`INSERT INTO profile (
			user_id, username, plan, custom_domain_status, cancel_at_period_end, created_at, updated_at
		) VALUES (?, ?, 'free', 'none', 0, ?, ?)`,
		[userId, username, now, now]
	);
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
	/** @type {Record<string, string | boolean>} */
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		const token = argv[i];
		if (!token.startsWith('--')) continue;
		const key = token.slice(2);
		const next = argv[i + 1];
		if (!next || next.startsWith('--')) {
			out[key] = true;
			continue;
		}
		out[key] = next;
		i++;
	}
	return out;
}

/**
 * @param {Record<string, string | boolean>} args
 */
async function resolvePassword(args) {
	if (typeof args.password === 'string') return args.password;
	if (!process.stdin.isTTY) {
		die('Pass --password when stdin is not a TTY.');
	}
	const first = await ask('Password: ', { secret: true });
	const second = await ask('Password (again): ', { secret: true });
	if (first !== second) die('Passwords do not match.');
	return first;
}

/**
 * @param {string} question
 * @param {{ secret?: boolean }} [opts]
 */
function ask(question, opts = {}) {
	if (!process.stdin.isTTY) {
		return Promise.reject(new Error(`${question.trim()} is required (pass a --flag).`));
	}

	if (!opts.secret) {
		const rl = createInterface({ input: process.stdin, output: process.stdout });
		return new Promise((resolve) => {
			rl.question(question, (answer) => {
				rl.close();
				resolve(answer);
			});
		});
	}

	return askSecret(question);
}

/**
 * @param {string} question
 * @returns {Promise<string>}
 */
function askSecret(question) {
	const { stdin, stdout } = process;
	stdout.write(question);

	return new Promise((resolve, reject) => {
		let value = '';
		stdin.setRawMode?.(true);
		stdin.resume();
		stdin.setEncoding('utf8');

		/** @param {string} chunk */
		const onData = (chunk) => {
			for (const char of chunk) {
				if (char === '\n' || char === '\r' || char === '\u0004') {
					stdin.setRawMode?.(false);
					stdin.pause();
					stdin.off('data', onData);
					stdout.write('\n');
					resolve(value);
					return;
				}
				if (char === '\u0003') {
					stdin.setRawMode?.(false);
					stdin.pause();
					stdin.off('data', onData);
					stdout.write('\n');
					reject(new Error('Interrupted.'));
					return;
				}
				if (char === '\u007f' || char === '\b') {
					value = value.slice(0, -1);
					continue;
				}
				value += char;
			}
		};

		stdin.on('data', onData);
	});
}

/**
 * @param {string} message
 * @returns {never}
 */
function die(message) {
	console.error(message);
	process.exit(1);
}
