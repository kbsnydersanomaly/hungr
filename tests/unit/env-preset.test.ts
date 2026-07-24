import { describe, it, expect } from "vitest";
import {
  applyEnvOverrides,
  describeTarget,
  parseArgs,
  parseEnvFile,
  withGeneratedHeader,
} from "../../scripts/env-preset";

describe("parseArgs", () => {
  it("accepts every command and defaults to refreshing", () => {
    expect(parseArgs(["local"])).toEqual({ command: "local", refresh: true });
    expect(parseArgs(["remote"])).toEqual({ command: "remote", refresh: true });
    expect(parseArgs(["which"])).toEqual({ command: "which", refresh: true });
  });

  it("honours --no-refresh on local", () => {
    expect(parseArgs(["local", "--no-refresh"])).toEqual({
      command: "local",
      refresh: false,
    });
  });

  it("rejects a missing or unknown command", () => {
    expect(() => parseArgs([])).toThrow(/got no command/);
    expect(() => parseArgs(["hosted"])).toThrow(/got "hosted"/);
  });

  it("rejects unknown flags and misplaced --no-refresh", () => {
    expect(() => parseArgs(["local", "--force"])).toThrow(
      /Unknown argument\(s\): --force/
    );
    expect(() => parseArgs(["remote", "--no-refresh"])).toThrow(
      /only applies to `env:local`/
    );
  });
});

describe("parseEnvFile", () => {
  it("reads pairs and ignores comments and blank lines", () => {
    const text = [
      "# Public application config",
      "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321",
      "",
      "# SUPABASE_DB_URL=postgresql://commented-out",
      "MAIL_PROVIDER = console ",
      "PAYFAST_PASSPHRASE=",
    ].join("\n");
    expect(parseEnvFile(text)).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      MAIL_PROVIDER: "console",
      PAYFAST_PASSPHRASE: "",
    });
  });

  it("handles CRLF files", () => {
    expect(parseEnvFile("A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" });
  });
});

describe("applyEnvOverrides", () => {
  const text = [
    "# Preset header",
    "NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=hosted-anon",
    "",
    "# Email",
    "MAIL_PROVIDER=brevo",
  ].join("\n");

  it("replaces values in place, keeping comments and order", () => {
    expect(
      applyEnvOverrides(text, {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anon",
      })
    ).toBe(
      [
        "# Preset header",
        "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon",
        "",
        "# Email",
        "MAIL_PROVIDER=brevo",
      ].join("\n")
    );
  });

  it("appends keys the file does not define yet", () => {
    const result = applyEnvOverrides("A=1\n", { B: "2" });
    expect(result).toBe("A=1\n\nB=2\n");
  });

  it("leaves commented-out keys commented out", () => {
    const commented = "# SUPABASE_DB_URL=postgresql://hosted\nSUPABASE_DB_URL=";
    expect(
      applyEnvOverrides(commented, { SUPABASE_DB_URL: "postgresql://local" })
    ).toBe("# SUPABASE_DB_URL=postgresql://hosted\nSUPABASE_DB_URL=postgresql://local");
  });

  it("preserves CRLF line endings", () => {
    expect(applyEnvOverrides("A=1\r\nB=2", { A: "9" })).toBe("A=9\r\nB=2");
  });

  it("returns the text unchanged when there is nothing to override", () => {
    expect(applyEnvOverrides(text, {})).toBe(text);
  });
});

describe("withGeneratedHeader", () => {
  it("replaces the base file's leading comment block", () => {
    const text = ["# Hosted preset", "# second line", "A=1", "# Email", "B=2"].join(
      "\n"
    );
    expect(withGeneratedHeader(text, ["# Local preset"])).toBe(
      ["# Local preset", "A=1", "# Email", "B=2"].join("\n")
    );
  });

  it("prepends the header when the base has no leading comment", () => {
    expect(withGeneratedHeader("A=1", ["# Local preset"])).toBe(
      "# Local preset\nA=1"
    );
  });

  it("preserves CRLF line endings", () => {
    expect(withGeneratedHeader("# old\r\nA=1", ["# new"])).toBe("# new\r\nA=1");
  });
});

describe("describeTarget", () => {
  it("labels loopback URLs local", () => {
    expect(describeTarget("http://127.0.0.1:54321")).toBe("local");
    expect(describeTarget("http://localhost:54321")).toBe("local");
  });

  it("labels Supabase-hosted projects hosted", () => {
    expect(describeTarget("https://bvkiqrgkommynhdvsdut.supabase.co")).toBe(
      "hosted"
    );
  });

  it("labels anything else unknown, and a missing value unset", () => {
    expect(describeTarget("https://db.example.com")).toBe("unknown");
    expect(describeTarget("not-a-url")).toBe("unknown");
    expect(describeTarget(undefined)).toBe("unset");
  });
});
