import { describe, it, expect, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  vi.stubEnv("PAYFAST_MERCHANT_ID", "10000100");
  vi.stubEnv("PAYFAST_MERCHANT_KEY", "46f0cd694581a");
  vi.stubEnv("PAYFAST_PASSPHRASE", "jt7NOE43FZPn");
});

import {
  getCardUpdateUrl,
  buildReplacementMPaymentId,
  isReplacementMPaymentId,
  parseReplacementMPaymentId,
} from "@/lib/billing/payfast";

describe("getCardUpdateUrl", () => {
  it("returns the hosted card-update URL for a token", () => {
    vi.stubEnv("PAYFAST_SANDBOX", "false");

    const url = getCardUpdateUrl("token-123");

    expect(url).toBe("https://www.payfast.co.za/eng/recurring/update/token-123");
  });

  it("appends a return URL when provided", () => {
    vi.stubEnv("PAYFAST_SANDBOX", "false");

    const url = getCardUpdateUrl("token-123", "https://example.com/billing");

    expect(url).toBe(
      "https://www.payfast.co.za/eng/recurring/update/token-123?return=https%3A%2F%2Fexample.com%2Fbilling"
    );
  });
});

describe("replacement m_payment_id helpers", () => {
  it("builds and parses a replacement id", () => {
    const oldSub = { id: "sub-123", payfast_token: "tok-456" };
    const mPaymentId = buildReplacementMPaymentId(oldSub);

    expect(isReplacementMPaymentId(mPaymentId)).toBe(true);

    const parsed = parseReplacementMPaymentId(mPaymentId);
    expect(parsed).toEqual({ oldSubId: "sub-123", oldToken: "tok-456" });
  });

  it("rejects non-replacement ids", () => {
    expect(isReplacementMPaymentId("org-123-xyz")).toBe(false);
    expect(parseReplacementMPaymentId("org-123-xyz")).toBeNull();
  });

  it("rejects malformed replacement ids", () => {
    expect(isReplacementMPaymentId("replace:too:few")).toBe(true);
    expect(parseReplacementMPaymentId("replace:too:few")).toBeNull();
  });
});
