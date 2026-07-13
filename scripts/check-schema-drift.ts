/**
 * Schema drift check: compares the migration files in supabase/migrations/
 * against the versions recorded in supabase_migrations.schema_migrations and
 * exits non-zero if any file is not recorded as applied.
 *
 * Note: the check is intentionally one-directional (files → table). The local
 * DB's schema_migrations also contains base-schema versions whose SQL files
 * are untracked in this repo, so table versions without files are expected
 * and must NOT be flagged.
 *
 * Usage: pnpm db:check
 * Connection: SUPABASE_DB_URL env var, else the local Supabase default.
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Extract the leading timestamp version from a migration filename. */
export function migrationVersion(file: string): string | null {
  const match = /^(\d+)_.*\.sql$/.exec(file);
  return match ? match[1] : null;
}

/**
 * Return the migration files whose version is not recorded as applied.
 * `files` are bare filenames; `appliedVersions` come from
 * supabase_migrations.schema_migrations.
 */
export function findUnappliedMigrations(
  files: string[],
  appliedVersions: string[]
): string[] {
  const applied = new Set(appliedVersions);
  return files.filter((file) => {
    const version = migrationVersion(file);
    return version !== null && !applied.has(version);
  });
}

function main() {
  const migrationsDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "supabase",
    "migrations"
  );
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Pass the password via PGPASSWORD instead of on the command line.
  const dbUrl = new URL(process.env.SUPABASE_DB_URL ?? DEFAULT_DB_URL);
  const password = decodeURIComponent(dbUrl.password);
  dbUrl.password = "";

  let output: string;
  try {
    output = execFileSync(
      "psql",
      [
        dbUrl.toString(),
        "-t",
        "-A",
        "-c",
        "SELECT version FROM supabase_migrations.schema_migrations;",
      ],
      { env: { ...process.env, PGPASSWORD: password }, encoding: "utf8" }
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(
        "db:check: `psql` was not found on PATH. Install the PostgreSQL client tools first."
      );
    } else {
      console.error(
        "db:check: failed to query supabase_migrations.schema_migrations:",
        (err as Error).message
      );
    }
    process.exit(1);
  }

  const appliedVersions = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const unapplied = findUnappliedMigrations(files, appliedVersions);
  if (unapplied.length > 0) {
    console.error(
      `db:check: ${unapplied.length} migration file(s) not recorded as applied:`
    );
    for (const file of unapplied) console.error(`  - ${file}`);
    console.error("Run `pnpm db:migrate` to apply pending migrations.");
    process.exit(1);
  }

  console.log(
    `db:check: OK — all ${files.length} migration file(s) are recorded as applied.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
