import { describe, it, expect } from "vitest";
import {
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
