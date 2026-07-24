import { describe, it, expect } from "vitest";
import { parseArgs } from "../../scripts/bootstrap-db";
import {
  assertLocalSupabaseUrl,
  isLocalSupabaseUrl,
  localTargetFromStatus,
  parseStatusJson,
} from "../../scripts/supabase-local";

describe("isLocalSupabaseUrl", () => {
  it("accepts loopback hosts", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://[::1]:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://0.0.0.0:54321")).toBe(true);
  });

  it("rejects the hosted project and other remote hosts", () => {
    expect(isLocalSupabaseUrl("https://bvkiqrgkommynhdvsdut.supabase.co")).toBe(
      false
    );
    expect(isLocalSupabaseUrl("https://db.example.com")).toBe(false);
  });

  it("rejects hosts that merely contain a local hostname", () => {
    expect(isLocalSupabaseUrl("https://localhost.evil.example")).toBe(false);
    expect(isLocalSupabaseUrl("https://127.0.0.1.example.com")).toBe(false);
  });

  it("rejects unparseable values", () => {
    expect(isLocalSupabaseUrl("")).toBe(false);
    expect(isLocalSupabaseUrl("127.0.0.1:54321")).toBe(false);
  });
});

describe("assertLocalSupabaseUrl", () => {
  it("passes for a local URL", () => {
    expect(() =>
      assertLocalSupabaseUrl("http://127.0.0.1:54321", "test")
    ).not.toThrow();
  });

  it("names the source and value when refusing", () => {
    expect(() =>
      assertLocalSupabaseUrl("https://bvkiqrgkommynhdvsdut.supabase.co", "test")
    ).toThrow(/test is "https:\/\/bvkiqrgkommynhdvsdut\.supabase\.co"/);
  });
});

describe("parseStatusJson", () => {
  it("extracts the JSON object from surrounding CLI chatter", () => {
    const output = [
      "Stopped services: [supabase_imgproxy_rebuild]",
      '{ "API_URL": "http://127.0.0.1:54321" }',
      "A new version of Supabase CLI is available: v2.109.1",
    ].join("\n");
    expect(parseStatusJson(output)).toEqual({
      API_URL: "http://127.0.0.1:54321",
    });
  });

  it("throws when the stack produced no JSON", () => {
    expect(() => parseStatusJson("supabase start is not running.")).toThrow(
      /no JSON object/
    );
  });
});

describe("localTargetFromStatus", () => {
  const status = {
    API_URL: "http://127.0.0.1:54321",
    SERVICE_ROLE_KEY: "service-role",
    DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  };

  it("returns the local target", () => {
    expect(localTargetFromStatus(status)).toEqual({
      apiUrl: status.API_URL,
      serviceRoleKey: status.SERVICE_ROLE_KEY,
      dbUrl: status.DB_URL,
    });
  });

  it("lists every missing field", () => {
    expect(() => localTargetFromStatus({ API_URL: status.API_URL })).toThrow(
      /missing SERVICE_ROLE_KEY, DB_URL/
    );
  });

  it("refuses a hosted API URL", () => {
    expect(() =>
      localTargetFromStatus({
        ...status,
        API_URL: "https://bvkiqrgkommynhdvsdut.supabase.co",
      })
    ).toThrow(/not a local Supabase URL/);
  });
});

describe("parseArgs", () => {
  it("defaults every flag to false", () => {
    expect(parseArgs([])).toEqual({
      "--fresh": false,
      "--skip-seed": false,
      "--skip-types": false,
    });
  });

  it("sets the flags that were passed", () => {
    expect(parseArgs(["--fresh", "--skip-types"])).toMatchObject({
      "--fresh": true,
      "--skip-seed": false,
      "--skip-types": true,
    });
  });

  it("rejects unknown arguments instead of ignoring them", () => {
    expect(() => parseArgs(["--force"])).toThrow(/Unknown argument\(s\): --force/);
  });
});
