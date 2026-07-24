import { describe, it, expect } from "vitest";
import {
  appliedVersionsFromMigrationList,
  findUnappliedMigrations,
  migrationVersion,
} from "../../scripts/check-schema-drift";

describe("migrationVersion", () => {
  it("extracts the leading timestamp from a migration filename", () => {
    expect(migrationVersion("20260615110000_banner_and_team_invite_fix.sql")).toBe(
      "20260615110000"
    );
  });

  it("returns null for non-migration filenames", () => {
    expect(migrationVersion("README.md")).toBeNull();
    expect(migrationVersion("seed.sql")).toBeNull();
  });
});

describe("findUnappliedMigrations", () => {
  const files = [
    "20260615110000_banner_and_team_invite_fix.sql",
    "20260624120000_invite_org_context.sql",
    "20260624130000_help_articles.sql",
  ];

  it("returns an empty list when every file is recorded as applied", () => {
    const applied = [
      "20260615110000",
      "20260624120000",
      "20260624130000",
      // Base-schema versions live in the table without matching files —
      // they must not affect the result.
      "20240101000000",
    ];
    expect(findUnappliedMigrations(files, applied)).toEqual([]);
  });

  it("lists files whose version is missing from schema_migrations", () => {
    expect(findUnappliedMigrations(files, ["20260615110000"])).toEqual([
      "20260624120000_invite_org_context.sql",
      "20260624130000_help_articles.sql",
    ]);
  });

  it("ignores files that do not look like timestamped migrations", () => {
    expect(findUnappliedMigrations(["notes.sql", ...files], files.map((f) => f.slice(0, 14)))).toEqual([]);
  });

  it("flags everything when nothing is applied", () => {
    expect(findUnappliedMigrations(files, [])).toEqual(files);
  });
});

describe("appliedVersionsFromMigrationList", () => {
  it("reads the Remote column out of real CLI output", () => {
    const output = [
      "Connecting to local database...",
      "",
      "  ",
      "   Local          | Remote         | Time (UTC)          ",
      "  ----------------|----------------|---------------------",
      "   20260717120001 | 20260717120001 | 2026-07-17 12:00:01 ",
      "",
      "A new version of Supabase CLI is available: v2.109.1",
    ].join("\n");
    expect(appliedVersionsFromMigrationList(output)).toEqual(["20260717120001"]);
  });

  it("omits files that have no ledger row", () => {
    const output = [
      "   Local          | Remote         | Time (UTC)          ",
      "  ----------------|----------------|---------------------",
      "   20260717120001 | 20260717120001 | 2026-07-17 12:00:01 ",
      "   20260718090000 |                | 2026-07-18 09:00:00 ",
    ].join("\n");
    expect(appliedVersionsFromMigrationList(output)).toEqual(["20260717120001"]);
  });

  it("keeps ledger rows that have no matching file", () => {
    const output = [
      "   Local          | Remote         | Time (UTC)          ",
      "  ----------------|----------------|---------------------",
      "                  | 20260615110000 | 2026-06-15 11:00:00 ",
    ].join("\n");
    expect(appliedVersionsFromMigrationList(output)).toEqual(["20260615110000"]);
  });

  it("returns nothing when the CLI printed no table", () => {
    expect(appliedVersionsFromMigrationList("Cannot connect to the database")).toEqual(
      []
    );
  });
});
