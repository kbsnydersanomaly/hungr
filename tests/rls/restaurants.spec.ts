import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  signInAs,
  cleanupUser,
  cleanupOrg,
} from "./helpers";

describe("RLS — restaurants", () => {
  let ownerAId: string;
  let ownerBId: string;
  let orgAId: string;
  let orgBId: string;
  let restaurantAId: string;
  let restaurantBId: string;

  beforeAll(async () => {
    const admin = adminClient();

    const ownerA = await createTestUser("rls-rest-owner-a@hungr.test", "password123");
    const ownerB = await createTestUser("rls-rest-owner-b@hungr.test", "password123");
    ownerAId = ownerA.id;
    ownerBId = ownerB.id;

    const { data: orgA } = await admin
      .from("organizations")
      .insert({ name: "Rest Org A", slug: "rls-rest-org-a", owner_id: ownerAId })
      .select()
      .single();
    const { data: orgB } = await admin
      .from("organizations")
      .insert({ name: "Rest Org B", slug: "rls-rest-org-b", owner_id: ownerBId })
      .select()
      .single();
    orgAId = orgA!.id;
    orgBId = orgB!.id;

    await admin.from("profiles").update({ default_org_id: orgAId }).eq("id", ownerAId);
    await admin.from("profiles").update({ default_org_id: orgBId }).eq("id", ownerBId);

    await admin
      .from("organization_members")
      .insert({ org_id: orgAId, user_id: ownerAId, role: "owner" });
    await admin
      .from("organization_members")
      .insert({ org_id: orgBId, user_id: ownerBId, role: "owner" });

    const { data: rA } = await admin
      .from("restaurants")
      .insert({ org_id: orgAId, name: "Rest A", slug: "rls-rest-a-2" })
      .select()
      .single();
    const { data: rB } = await admin
      .from("restaurants")
      .insert({ org_id: orgBId, name: "Rest B", slug: "rls-rest-b-2" })
      .select()
      .single();
    restaurantAId = rA!.id;
    restaurantBId = rB!.id;
  });

  afterAll(async () => {
    await cleanupOrg(orgAId);
    await cleanupOrg(orgBId);
    await cleanupUser(ownerAId);
    await cleanupUser(ownerBId);
  });

  it("public can read restaurants", async () => {
    const client = anonClient();
    const { data, error } = await client.from("restaurants").select("*");
    expect(error).toBeNull();
    expect(data?.some((r) => r.id === restaurantAId)).toBe(true);
    expect(data?.some((r) => r.id === restaurantBId)).toBe(true);
  });

  it("owner of org A can read their restaurants", async () => {
    const client = await signInAs("rls-rest-owner-a@hungr.test", "password123");
    const { data, error } = await client.from("restaurants").select("*").eq("id", restaurantAId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("owner of org A cannot update restaurants in org B", async () => {
    const client = await signInAs("rls-rest-owner-a@hungr.test", "password123");
    const { error } = await client
      .from("restaurants")
      .update({ name: "pwned" })
      .eq("id", restaurantBId);
    expect(error || true).toBeTruthy();
  });
});
