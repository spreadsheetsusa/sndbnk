/**
 * @deprecated Use `bun run db:migrate` instead.
 *
 * Schema changes are now Drizzle SQL migrations in `drizzle/`. This stub remains
 * so older docs/commands fail loudly with the new path rather than silently no-op.
 */
console.error(`
db:push is retired.

Schema changes:
  1. Edit src/lib/server/db/schema.js
  2. bun run db:generate
  3. Review the new file under drizzle/
  4. bun run db:migrate

Production deploy runs db:migrate. See docs/drizzle-migrations.html.
`);
process.exit(1);
