/**
 * Apply the SQLite schema using Bun's native driver.
 * drizzle-kit's push path loads better-sqlite3, which Bun cannot open.
 */
import { Database } from 'bun:sqlite';

const dbPath = process.env.DATABASE_URL;
if (!dbPath) {
	throw new Error('DATABASE_URL is not set');
}

const db = new Database(dbPath, { create: true });
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS task (
	id text PRIMARY KEY NOT NULL,
	title text NOT NULL,
	priority integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS user (
	id text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	email text NOT NULL,
	email_verified integer DEFAULT false NOT NULL,
	image text,
	created_at integer NOT NULL,
	updated_at integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique ON user (email);

CREATE TABLE IF NOT EXISTS session (
	id text PRIMARY KEY NOT NULL,
	expires_at integer NOT NULL,
	token text NOT NULL,
	created_at integer NOT NULL,
	updated_at integer NOT NULL,
	ip_address text,
	user_agent text,
	user_id text NOT NULL,
	FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS session_token_unique ON session (token);
CREATE INDEX IF NOT EXISTS session_userId_idx ON session (user_id);

CREATE TABLE IF NOT EXISTS account (
	id text PRIMARY KEY NOT NULL,
	account_id text NOT NULL,
	provider_id text NOT NULL,
	user_id text NOT NULL,
	access_token text,
	refresh_token text,
	id_token text,
	access_token_expires_at integer,
	refresh_token_expires_at integer,
	scope text,
	password text,
	created_at integer NOT NULL,
	updated_at integer NOT NULL,
	FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS account_userId_idx ON account (user_id);

CREATE TABLE IF NOT EXISTS verification (
	id text PRIMARY KEY NOT NULL,
	identifier text NOT NULL,
	value text NOT NULL,
	expires_at integer NOT NULL,
	created_at integer NOT NULL,
	updated_at integer NOT NULL
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification (identifier);
`);

const tables = db
	.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
	.all()
	.map((row) => row.name);

console.log(`Schema applied to ${dbPath}`);
console.log(`Tables: ${tables.join(', ') || '(none)'}`);
db.close();
