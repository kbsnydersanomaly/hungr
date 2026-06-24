import { describe, it, expect } from "vitest";
import { computeInviteStatus } from "@/lib/team/invite-status";

const NOW = new Date("2026-06-24T12:00:00Z");
const FUTURE = "2026-07-01T12:00:00Z";
const PAST = "2026-06-01T12:00:00Z";

describe("computeInviteStatus", () => {
  it("returns pending when not accepted, revoked, or expired", () => {
    expect(
      computeInviteStatus(
        { accepted_at: null, revoked_at: null, expires_at: FUTURE },
        NOW
      )
    ).toBe("pending");
  });

  it("returns expired when past expiry and not yet accepted/revoked", () => {
    expect(
      computeInviteStatus(
        { accepted_at: null, revoked_at: null, expires_at: PAST },
        NOW
      )
    ).toBe("expired");
  });

  it("returns revoked over expired when not accepted", () => {
    expect(
      computeInviteStatus(
        { accepted_at: null, revoked_at: PAST, expires_at: PAST },
        NOW
      )
    ).toBe("revoked");
  });

  it("returns accepted even when past expiry", () => {
    expect(
      computeInviteStatus(
        { accepted_at: PAST, revoked_at: null, expires_at: PAST },
        NOW
      )
    ).toBe("accepted");
  });

  it("prefers accepted over revoked", () => {
    expect(
      computeInviteStatus(
        { accepted_at: PAST, revoked_at: PAST, expires_at: FUTURE },
        NOW
      )
    ).toBe("accepted");
  });
});
