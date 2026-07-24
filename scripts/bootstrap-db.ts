/**
 * One-command local database bootstrap (roadmap P0-E1b; design
 * docs/superpowers/specs/2026-07-24-database-bootstrap-design.md §5.5).
 *
 * Starts the local Supabase stack, rebuilds the database from
 * supabase/migrations/ (the squashed baseline carries the public schema *and*
 * the non-public Auth/Storage objects), seeds idempotently, and regenerates
 * lib/database.types.ts.
 *
 * The target is always resolved from `supabase status`, never from .env.local —
 * .env.local normally points at the hosted project, and `db reset` is
 * destructive. A non-loopback API URL aborts the run.
 *
 * Usage: pnpm db:bootstrap [--fresh] [--skip-seed] [--skip-types]
 *   --fresh       discard the existing local volume first (`supabase stop --no-backup`)
 *   --skip-seed   apply migrations only
 *   --skip-types  leave lib/database.types.ts untouched
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { localTargetFromStatus, parseStatusJson } from "./supabase-local";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_CLI = path.join(
  ROOT,
  "node_modules",
  "supabase",
  "dist",
  "supabase.js"
);
const TYPES_FILE = path.join(ROOT, "lib", "database.types.ts");

const FLAGS = ["--fresh", "--skip-seed", "--skip-types"] as const;
type Flag = (typeof FLAGS)[number];

/** Validate CLI arguments and return the flags that were set. */
export function parseArgs(argv: string[]): Record<Flag, boolean> {
  const unknown = argv.filter((arg) => !FLAGS.includes(arg as Flag));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown argument(s): ${unknown.join(", ")}. Supported flags: ${FLAGS.join(", ")}.`
    );
  }
  return {
    "--fresh": argv.includes("--fresh"),
    "--skip-seed": argv.includes("--skip-seed"),
    "--skip-types": argv.includes("--skip-types"),
  };
}

/**
 * Run the repository-pinned Supabase CLI through Node so the same code path
 * works on Windows and POSIX without a shell.
 */
function supabase(args: string[], capture = false): string {
  if (!existsSync(SUPABASE_CLI)) {
    throw new Error(
      `Supabase CLI not found at ${SUPABASE_CLI}. Run \`pnpm install\` first.`
    );
  }
  return (
    execFileSync(process.execPath, [SUPABASE_CLI, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
      maxBuffer: 32 * 1024 * 1024,
    }) ?? ""
  );
}

function step(message: string): void {
  console.log(`\n=== ${message} ===`);
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));

  if (flags["--fresh"]) {
    step("Discarding the existing local volume");
    try {
      supabase(["stop", "--no-backup"]);
    } catch {
      // Nothing running, or already stopped — both are fine.
      console.log("Local stack was not running.");
    }
  }

  step("Starting the local Supabase stack");
  supabase(["start"]);

  const target = localTargetFromStatus(
    parseStatusJson(supabase(["status", "-o", "json"], true))
  );
  console.log(`Target: ${target.apiUrl}`);

  step("Applying migrations (supabase db reset)");
  supabase(["db", "reset"]);

  if (flags["--skip-seed"]) {
    console.log("\nSkipping seed (--skip-seed).");
  } else {
    step("Seeding");
    // Pin the local target before importing: db/seed.ts loads .env.local via
    // dotenv, which does not overwrite variables already set here.
    process.env.NEXT_PUBLIC_SUPABASE_URL = target.apiUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = target.serviceRoleKey;
    const { seed } = await import("../db/seed");
    await seed();
  }

  if (flags["--skip-types"]) {
    console.log("\nSkipping type generation (--skip-types).");
  } else {
    step("Regenerating lib/database.types.ts");
    writeFileSync(
      TYPES_FILE,
      supabase(["gen", "types", "typescript", "--local"], true)
    );
  }

  step("Bootstrap complete");
  console.log(`API:      ${target.apiUrl}`);
  console.log(`Database: ${target.dbUrl}`);
  console.log(
    "Point the app at it with NEXT_PUBLIC_SUPABASE_URL / keys from `supabase status`."
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`\ndb:bootstrap failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}
