/**
 * Runtime SQLite pragmas for the app, worker, migrator, and backup.
 * WAL + busy_timeout so the HTTP process and waveform worker can share one file
 * without SQLITE_BUSY; NORMAL is the usual pairing with WAL.
 */
export const SQLITE_PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
`.trim();
