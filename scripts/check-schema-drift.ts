/**
 * Schema drift check: compares the migration files in supabase/migrations/
 * against the versions recorded in supabase_migrations.schema_migrations and
 * exits non-zero if any file is not recorded as applied.
 *
 * Note: the check is intentionally one-directional (files → table). Since the
 * P0-E1a squash both ledgers hold exactly the tracked migrations, but the
 * direction is kept: a database provisioned before the squash still carries
 * the 14 superseded versions, and those must NOT be flagged.
 *
 * The ledger is read through the repository-pinned Supabase CLI rather than
 * `psql`, so the check runs anywhere `pnpm install` has run — including this
 * Windows workstation and CI (P0-E2b) — without PostgreSQL client tools.
 *
 * Usage: pnpm db:check
 * Connection: SUPABASE_DB_URL env var, else the local Supabase stack.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_CLI = path.join(
  ROOT,
  "node_modules",
  "supabase",
  "dist",
  "supabase.js"
);

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

/**
 * Pull the applied versions out of `supabase migration list` table output.
 *
 * The CLI prints a `Local | Remote | Time (UTC)` table wrapped in update
 * notices and connection chatter. The Remote column is the ledger: a row with
 * an empty Remote cell is a file that has not been applied, and a row with an
 * empty Local cell is a ledger entry with no matching file (expected on a
 * database provisioned before the squash).
 */
export function appliedVersionsFromMigrationList(output: string): string[] {
  return output
    .split("\n")
    .filter((line) => line.includes("|"))
    .map((line) => line.split("|")[1]?.trim() ?? "")
    .filter((version) => /^\d+$/.test(version));
}

function main() {
  const migrationsDir = path.join(ROOT, "supabase", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (!existsSync(SUPABASE_CLI)) {
    console.error(
      `db:check: Supabase CLI not found at ${SUPABASE_CLI}. Run \`pnpm install\` first.`
    );
    process.exit(1);
  }

  const dbUrl = process.env.SUPABASE_DB_URL;
  const target = dbUrl ? ["--db-url", dbUrl] : ["--local"];

  let output: string;
  try {
    output = execFileSync(
      process.execPath,
      [SUPABASE_CLI, "migration", "list", ...target],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }
    );
  } catch (err) {
    console.error(
      "db:check: failed to read supabase_migrations.schema_migrations:",
      (err as Error).message
    );
    process.exit(1);
  }

  const appliedVersions = appliedVersionsFromMigrationList(output);

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
