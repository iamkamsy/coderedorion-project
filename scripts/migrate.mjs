// Applies db/migrations/*.sql in filename order, once each.
// Usage: pnpm db:migrate   (reads DATABASE_URL from .env.local or the environment)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to the existing environment.
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = join(process.cwd(), "db", "migrations");

try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const applied = new Set((await sql`SELECT name FROM schema_migrations`).map((r) => r.name));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    process.stdout.write(`Applying ${file} ... `);
    await sql.unsafe(readFileSync(join(dir, file), "utf8"));
    await sql`INSERT INTO schema_migrations (name) VALUES (${file})`;
    console.log("done");
  }
  console.log("Migrations up to date.");
} catch (err) {
  console.error("\nMigration failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
