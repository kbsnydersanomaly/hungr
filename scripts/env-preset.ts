/**
 * Switch `.env.local` between the local and hosted Supabase presets
 * (roadmap P0-E1d).
 *
 * The previous package scripts shelled out to `cp` and `grep`, neither of which
 * exists in the default Windows shell, and nothing ever created the
 * `.env.local-db` preset `pnpm env:local` copies from. This script does both in
 * Node so it behaves the same on Windows and POSIX.
 *
 * `pnpm env:local` regenerates `.env.local-db` from `supabase status` (only the
 * four Supabase-specific variables; every other setting in the file is kept) and
 * then activates it. With the stack stopped it falls back to the existing
 * preset. `pnpm env:remote` activates `.env.remote-db`, which holds hosted
 * credentials this script cannot synthesise.
 *
 * Usage: pnpm env:local [--no-refresh] | pnpm env:remote | pnpm env:which
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  isLocalSupabaseUrl,
  localTargetFromStatus,
  parseStatusJson,
} from "./supabase-local";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_CLI = path.join(
  ROOT,
  "node_modules",
  "supabase",
  "dist",
  "supabase.js"
);

const ACTIVE_FILE = path.join(ROOT, ".env.local");
const LOCAL_PRESET = path.join(ROOT, ".env.local-db");
const REMOTE_PRESET = path.join(ROOT, ".env.remote-db");
const EXAMPLE_FILE = path.join(ROOT, ".env.example");

/** The variable every command reports on, and the one that identifies a preset. */
const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";

const COMMANDS = ["local", "remote", "which"] as const;
export type Command = (typeof COMMANDS)[number];

export interface ParsedArgs {
  command: Command;
  refresh: boolean;
}

/**
 * Validate CLI arguments. `--no-refresh` skips the `supabase status` probe and
 * uses `.env.local-db` exactly as it is on disk.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  if (!COMMANDS.includes(command as Command)) {
    throw new Error(
      `Expected one of ${COMMANDS.join(", ")}, got ${command ? `"${command}"` : "no command"}.`
    );
  }
  const unknown = rest.filter((arg) => arg !== "--no-refresh");
  if (unknown.length > 0) {
    throw new Error(
      `Unknown argument(s): ${unknown.join(", ")}. Supported flags: --no-refresh.`
    );
  }
  if (rest.includes("--no-refresh") && command !== "local") {
    throw new Error("--no-refresh only applies to `env:local`.");
  }
  return { command: command as Command, refresh: !rest.includes("--no-refresh") };
}

/** Read `KEY=value` pairs from dotenv text, ignoring comments and blank lines. */
export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

/**
 * Replace the values of `overrides` in dotenv text, in place, preserving
 * comments, ordering, and line endings. Keys the text does not already contain
 * are appended.
 */
export function applyEnvOverrides(
  text: string,
  overrides: Record<string, string>
): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const remaining = new Map(Object.entries(overrides));
  const lines = text.split(/\r?\n/).map((line) => {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    const key = match?.[1];
    if (!key || !remaining.has(key)) return line;
    const value = remaining.get(key)!;
    remaining.delete(key);
    return `${key}=${value}`;
  });

  if (remaining.size > 0) {
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }
    lines.push("");
    for (const [key, value] of remaining) lines.push(`${key}=${value}`);
    lines.push("");
  }
  return lines.join(eol);
}

/**
 * Replace the leading comment block of dotenv text with `header`. Used when
 * `.env.local-db` is derived from the hosted preset, whose opening comment would
 * otherwise claim the file is the hosted one.
 */
export function withGeneratedHeader(text: string, header: string[]): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  let start = 0;
  while (start < lines.length && lines[start].trimStart().startsWith("#")) {
    start += 1;
  }
  return [...header, ...lines.slice(start)].join(eol);
}

/** Classify the Supabase URL a preset points at, for human-readable output. */
export function describeTarget(url: string | undefined): string {
  if (!url) return "unset";
  if (isLocalSupabaseUrl(url)) return "local";
  if (/\.supabase\.(co|in)$/.test(safeHostname(url))) return "hosted";
  return "unknown";
}

function safeHostname(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

/** Run the repository-pinned Supabase CLI without a shell. */
function supabase(args: string[]): string {
  if (!existsSync(SUPABASE_CLI)) {
    throw new Error(
      `Supabase CLI not found at ${SUPABASE_CLI}. Run \`pnpm install\` first.`
    );
  }
  return (
    execFileSync(process.execPath, [SUPABASE_CLI, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 32 * 1024 * 1024,
    }) ?? ""
  );
}

/**
 * Choose the text a freshly created `.env.local-db` starts from: the hosted
 * preset when it exists (so shared mail/PayFast/observability settings carry
 * over), otherwise the committed example file.
 */
function localPresetBase(): { text: string; derived: boolean } {
  if (existsSync(LOCAL_PRESET)) {
    return { text: readFileSync(LOCAL_PRESET, "utf8"), derived: false };
  }
  for (const source of [REMOTE_PRESET, EXAMPLE_FILE]) {
    if (existsSync(source)) {
      return { text: readFileSync(source, "utf8"), derived: true };
    }
  }
  throw new Error(
    `No preset to build .env.local-db from: ${rel(REMOTE_PRESET)} and ${rel(EXAMPLE_FILE)} are both missing.`
  );
}

function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

/** Refresh `.env.local-db` from a running local stack, creating it if needed. */
function writeLocalPreset(): void {
  const status = parseStatusJson(supabase(["status", "-o", "json"]));
  const target = localTargetFromStatus(status);
  const anonKey = status.ANON_KEY;
  if (!anonKey) {
    throw new Error(
      "`supabase status` is missing ANON_KEY. Run `supabase start` first."
    );
  }

  const { text: baseText, derived } = localPresetBase();
  const text = derived
    ? withGeneratedHeader(baseText, [
        "# Local Supabase preset — activate with `pnpm env:local`.",
        "# Created from the hosted preset (or .env.example); the Supabase URL, keys,",
        "# and database URL are refreshed from `supabase status` on every switch.",
      ])
    : baseText;
  const overrides: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: target.apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: target.serviceRoleKey,
    SUPABASE_DB_URL: target.dbUrl,
  };
  // A preset derived from the hosted file would otherwise send real email from
  // a local database; an existing local preset keeps whatever it is set to.
  if (derived) overrides.MAIL_PROVIDER = "console";

  writeFileSync(LOCAL_PRESET, applyEnvOverrides(text, overrides));
  console.log(
    `${derived ? "Created" : "Refreshed"} ${rel(LOCAL_PRESET)} from \`supabase status\`.`
  );
}

/** Copy a preset onto `.env.local` and report the target it now points at. */
function activate(preset: string): void {
  const text = readFileSync(preset, "utf8");
  writeFileSync(ACTIVE_FILE, text);
  const url = parseEnvFile(text)[URL_KEY];
  console.log(
    `${rel(ACTIVE_FILE)} <- ${rel(preset)}\n${URL_KEY}=${url ?? "(unset)"}  [${describeTarget(url)}]`
  );
  console.log("Restart `pnpm dev` to pick up the change.");
}

function activateLocal(refresh: boolean): void {
  if (refresh) {
    try {
      writeLocalPreset();
    } catch (error: unknown) {
      if (!existsSync(LOCAL_PRESET)) {
        throw new Error(
          `${error instanceof Error ? error.message : error}\n` +
            `Cannot create ${rel(LOCAL_PRESET)} without a running local stack. Run \`pnpm db:bootstrap\` first.`
        );
      }
      console.warn(
        `Could not read \`supabase status\` (${error instanceof Error ? error.message : error}).\n` +
          `Using the existing ${rel(LOCAL_PRESET)} unchanged.`
      );
    }
  } else if (!existsSync(LOCAL_PRESET)) {
    throw new Error(
      `${rel(LOCAL_PRESET)} does not exist. Start the local stack and run \`pnpm env:local\` without --no-refresh.`
    );
  }
  activate(LOCAL_PRESET);
}

function activateRemote(): void {
  if (!existsSync(REMOTE_PRESET)) {
    throw new Error(
      `${rel(REMOTE_PRESET)} does not exist. Create it from ${rel(EXAMPLE_FILE)} with the hosted project's URL and keys — ` +
        "hosted credentials cannot be generated locally."
    );
  }
  activate(REMOTE_PRESET);
}

function which(): void {
  if (!existsSync(ACTIVE_FILE)) {
    throw new Error(
      `${rel(ACTIVE_FILE)} does not exist. Run \`pnpm env:local\` or \`pnpm env:remote\`.`
    );
  }
  const url = parseEnvFile(readFileSync(ACTIVE_FILE, "utf8"))[URL_KEY];
  console.log(`${URL_KEY}=${url ?? "(unset)"}  [${describeTarget(url)}]`);
}

function main(): void {
  const { command, refresh } = parseArgs(process.argv.slice(2));
  if (command === "local") activateLocal(refresh);
  else if (command === "remote") activateRemote();
  else which();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error: unknown) {
    console.error(
      `\nenv preset failed: ${error instanceof Error ? error.message : error}`
    );
    process.exit(1);
  }
}
