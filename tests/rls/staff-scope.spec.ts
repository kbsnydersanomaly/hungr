import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  adminClient,
  createTestUser,
  signInAs,
  cleanupUser,
  cleanupOrg,
} from "./helpers";

/**
 * has_restaurant_access() backs the member-read RLS policies. Staff come in
 * two flavours (organization_members.restaurant_scoped): org-wide staff read
 * every restaurant in the org, restaurant-scoped staff only the ones they hold
 * restaurant_members rows for. Draft menus are used as the probe because the
 * public-read policy only exposes published menus.
 */
describe("RLS — staff scope", () => {
  let ownerId: string;
  let scopedStaffId: string;
  let orgWideStaffId: string;
  let orgId: string;
  let restaurantAId: string;
  let restaurantBId: string;
  let menuAId: string;
  let menuBId: string;

  beforeAll(async () => {
    const admin = adminClient();

    const owner = await createTestUser("rls-scope-owner@hungr.test", "password123");
    const scoped = await createTestUser("rls-scope-scoped@hungr.test", "password123");
    const orgWide = await createTestUser("rls-scope-orgwide@hungr.test", "password123");
    ownerId = owner.id;
    scopedStaffId = scoped.id;
    orgWideStaffId = orgWide.id;

    const { data: org } = await admin
      .from("organizations")
      .insert({ name: "Scope Org", slug: "rls-scope-org", owner_id: ownerId })
      .select()
      .single();
    orgId = org!.id;

    await admin
      .from("organization_members")
      .insert({ org_id: orgId, user_id: ownerId, role: "owner" });
    await admin.from("organization_members").insert({
      org_id: orgId,
      user_id: scopedStaffId,
      role: "staff",
      restaurant_scoped: true,
    });
    await admin.from("organization_members").insert({
      org_id: orgId,
      user_id: orgWideStaffId,
      role: "staff",
      restaurant_scoped: false,
    });

    const { data: rA } = await admin
      .from("restaurants")
      .insert({ org_id: orgId, name: "Scope Rest A", slug: "rls-scope-rest-a" })
      .select()
      .single();
    const { data: rB } = await admin
      .from("restaurants")
      .insert({ org_id: orgId, name: "Scope Rest B", slug: "rls-scope-rest-b" })
      .select()
      .single();
    restaurantAId = rA!.id;
    restaurantBId = rB!.id;

    await admin.from("restaurant_members").insert({
      restaurant_id: restaurantAId,
      user_id: scopedStaffId,
      role: "staff",
    });

    const { data: mA } = await admin
      .from("menus")
      .insert({
        restaurant_id: restaurantAId,
        name: "Scope Menu A",
        slug: "rls-scope-menu-a",
        status: "draft",
      })
      .select()
      .single();
    const { data: mB } = await admin
      .from("menus")
      .insert({
        restaurant_id: restaurantBId,
        name: "Scope Menu B",
        slug: "rls-scope-menu-b",
        status: "draft",
      })
      .select()
      .single();
    menuAId = mA!.id;
    menuBId = mB!.id;
  });

  afterAll(async () => {
    await cleanupOrg(orgId);
    await cleanupUser(scopedStaffId);
    await cleanupUser(orgWideStaffId);
    await cleanupUser(ownerId);
  });

  it("restaurant-scoped staff read only their assigned restaurant's draft menus", async () => {
    const client = await signInAs("rls-scope-scoped@hungr.test", "password123");
    const { data, error } = await client
      .from("menus")
      .select("id")
      .in("id", [menuAId, menuBId]);
    expect(error).toBeNull();
    expect(data?.map((m) => m.id)).toEqual([menuAId]);
  });

  it("org-wide staff read draft menus of every restaurant in the org", async () => {
    const client = await signInAs("rls-scope-orgwide@hungr.test", "password123");
    const { data, error } = await client
      .from("menus")
      .select("id")
      .in("id", [menuAId, menuBId]);
    expect(error).toBeNull();
    expect(data?.map((m) => m.id).sort()).toEqual([menuAId, menuBId].sort());
  });
});
