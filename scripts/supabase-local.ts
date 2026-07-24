/**
 * Shared helpers for tooling that must only ever act on the local Supabase
 * stack (`pnpm db:bootstrap`, `pnpm db:seed`).
 *
 * `.env.local` in this repository normally points at the hosted project, so a
 * destructive or data-writing script must resolve its target explicitly and
 * refuse anything that is not loopback. These helpers are pure so they can be
 * unit tested without Docker or a database.
 */

/** Hostnames that identify a Supabase stack running on this machine. */
const LOCAL_HOSTNAMES = new Set([
  "127.0.0.1",
  "0.0.0.0",
  "localhost",
  "::1",
  "[::1]",
]);

/** True when `value` is a parseable URL served from this machine. */
export function isLocalSupabaseUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return LOCAL_HOSTNAMES.has(url.hostname);
}

export interface LocalSupabaseTarget {
  apiUrl: string;
  serviceRoleKey: string;
  dbUrl: string;
}

/**
 * Extract the JSON object from `supabase status -o json` output. The CLI mixes
 * update notices and service chatter around the payload, so the JSON is located
 * rather than assumed to be the whole string.
 */
export function parseStatusJson(output: string): Record<string, string> {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error(
      "`supabase status -o json` produced no JSON object. Is the local stack running?"
    );
  }
  const parsed: unknown = JSON.parse(output.slice(start, end + 1));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("`supabase status -o json` did not return an object.");
  }
  return parsed as Record<string, string>;
}

/**
 * Read the API URL, service-role key, and database URL out of parsed status
 * output, failing when any is missing or when the API URL is not local.
 */
export function localTargetFromStatus(
  status: Record<string, string>
): LocalSupabaseTarget {
  const apiUrl = status.API_URL;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  const dbUrl = status.DB_URL;

  const missing = [
    apiUrl ? null : "API_URL",
    serviceRoleKey ? null : "SERVICE_ROLE_KEY",
    dbUrl ? null : "DB_URL",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `\`supabase status\` is missing ${missing.join(", ")}. Run \`supabase start\` first.`
    );
  }

  assertLocalSupabaseUrl(apiUrl, "supabase status API_URL");
  return { apiUrl, serviceRoleKey, dbUrl };
}

/** Throw unless `value` is a local Supabase URL. */
export function assertLocalSupabaseUrl(value: string, source: string): void {
  if (!isLocalSupabaseUrl(value)) {
    throw new Error(
      `Refusing to continue: ${source} is "${value}", which is not a local Supabase URL. ` +
        "This command only ever targets the local stack."
    );
  }
}
