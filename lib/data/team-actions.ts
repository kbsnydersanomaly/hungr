"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { createServerClient } from "@/lib/supabase/server";
import { requireOrgAccess, requireRestaurantAccess } from "@/lib/auth/role";
import { safeAction, ValidationError, actionError } from "@/lib/errors";
import * as Sentry from "@sentry/nextjs";
import { sendMail } from "@/lib/mail";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/utils/audit";
import { InviteSchema } from "@/lib/schemas/invitations";
import type { OrgRole } from "@/lib/auth/role";

export async function inviteMember(formData: FormData) {
  return safeAction(async () => {
    const raw = Object.fromEntries(formData);
    const parsed = InviteSchema.parse(raw);

    const { user, supabase } = await requireOrgAccess(parsed.orgId, "admin");

    if (parsed.restaurantId) {
      await requireRestaurantAccess(parsed.restaurantId, "manager");
      if (parsed.role === "owner" || parsed.role === "admin") {
        throw new ValidationError("Restaurant invitations only support manager or staff roles.");
      }
    }

    if (parsed.role === "owner") {
      await requireOrgAccess(parsed.orgId, "owner");
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", parsed.email)
      .maybeSingle();

    if (existingProfile) {
      const { data: existingMembership } = await supabase
        .from("organization_members")
        .select("role")
        .eq("org_id", parsed.orgId)
        .eq("user_id", existingProfile.id)
        .maybeSingle();

      if (existingMembership) {
        throw new ValidationError("This user is already a member of the organization.");
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Match the lower(email) unique index so casing differences don't create dupes.
    const { data: existingInvite } = await supabase
      .from("invitations")
      .select("id")
      .ilike("email", parsed.email)
      .eq("org_id", parsed.orgId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .maybeSingle();

    const resent = Boolean(existingInvite);
    if (existingInvite) {
      await supabase
        .from("invitations")
        .update({ token, expires_at: expiresAt, role: parsed.role, restaurant_id: parsed.restaurantId ?? null })
        .eq("id", existingInvite.id);
    } else {
      await supabase.from("invitations").insert({
        token,
        email: parsed.email,
        org_id: parsed.orgId,
        restaurant_id: parsed.restaurantId ?? null,
        role: parsed.role,
        invited_by: user.id,
        expires_at: expiresAt,
      });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", parsed.orgId)
      .single();

    // The invite row is already saved; an email failure shouldn't lose it. Surface a
    // clear, actionable message so the admin can use Resend instead.
    try {
      await sendMail("invitation", parsed.email, {
        invite_url: `${env.NEXT_PUBLIC_APP_URL}/accept-invite/${token}`,
        org_name: org?.name ?? "your organization",
        inviter_name: user.user_metadata?.display_name ?? user.email ?? "Someone",
        role: parsed.role,
      });
    } catch (err) {
      console.error("invitation email failed:", err);
      Sentry.captureException(err);
      throw new ValidationError(
        "Invite saved, but the email failed to send. Use Resend to try again."
      );
    }

    await writeAudit({
      action: "team.invite",
      org_id: parsed.orgId,
      restaurant_id: parsed.restaurantId ?? undefined,
      target_table: "invitations",
      diff: { email: parsed.email, role: parsed.role },
    });

    revalidatePath("/settings/team");
    if (parsed.restaurantId) {
      revalidatePath(`/restaurants/${parsed.restaurantId}/team`);
    }

    return { invited: true, resent };
  });
}

export async function revokeInvitation(invitationId: string) {
  return safeAction(async () => {
    const supabase = await createServerClient();
    const { data: inv } = await supabase
      .from("invitations")
      .select("org_id, restaurant_id")
      .eq("id", invitationId)
      .single();

    if (!inv) throw new ValidationError("Invitation not found.");

    await requireOrgAccess(inv.org_id, "admin");

    await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitationId);

    await writeAudit({
      action: "team.invite.revoke",
      org_id: inv.org_id,
      restaurant_id: inv.restaurant_id ?? undefined,
      target_table: "invitations",
      target_id: invitationId,
    });

    revalidatePath("/settings/team");
    if (inv.restaurant_id) {
      revalidatePath(`/restaurants/${inv.restaurant_id}/team`);
    }

    return { revoked: true };
  });
}

export async function resendInvitation(invitationId: string) {
  return safeAction(async () => {
    const supabase = await createServerClient();
    const { data: inv } = await supabase
      .from("invitations")
      .select("email, org_id, restaurant_id, role, accepted_at")
      .eq("id", invitationId)
      .single();

    if (!inv) throw new ValidationError("Invitation not found.");
    if (inv.accepted_at) throw new ValidationError("This invitation has already been accepted.");

    const { user } = await requireOrgAccess(inv.org_id, "admin");

    // Fresh token + expiry, and un-revoke if it had been revoked.
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from("invitations")
      .update({ token, expires_at: expiresAt, revoked_at: null })
      .eq("id", invitationId);

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", inv.org_id)
      .single();

    try {
      await sendMail("invitation", inv.email, {
        invite_url: `${env.NEXT_PUBLIC_APP_URL}/accept-invite/${token}`,
        org_name: org?.name ?? "your organization",
        inviter_name: user.user_metadata?.display_name ?? user.email ?? "Someone",
        role: inv.role,
      });
    } catch (err) {
      console.error("invitation email failed:", err);
      throw actionError("Failed to send the invitation email", err);
    }

    await writeAudit({
      action: "team.invite.resend",
      org_id: inv.org_id,
      restaurant_id: inv.restaurant_id ?? undefined,
      target_table: "invitations",
      target_id: invitationId,
    });

    revalidatePath("/settings/team");
    if (inv.restaurant_id) {
      revalidatePath(`/restaurants/${inv.restaurant_id}/team`);
    }

    return { resent: true };
  });
}

export async function changeMemberRole(orgId: string, userId: string, role: OrgRole) {
  return safeAction(async () => {
    const { supabase } = await requireOrgAccess(orgId, "admin");

    const { data: current } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single();

    if (!current) throw new ValidationError("Member not found.");

    if (current.role === "owner" || role === "owner") {
      await requireOrgAccess(orgId, "owner");
    }

    if (current.role === "owner" && role !== "owner") {
      const { count } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("role", "owner");

      if ((count ?? 0) < 2) {
        throw new ValidationError("Cannot demote the last owner. Transfer ownership first.");
      }
    }

    await supabase
      .from("organization_members")
      .update({ role })
      .eq("org_id", orgId)
      .eq("user_id", userId);

    await writeAudit({
      action: "team.role.change",
      org_id: orgId,
      target_table: "organization_members",
      target_id: userId,
      diff: { from: current.role, to: role },
    });

    revalidatePath("/settings/team");
    revalidatePath("/dashboard");

    return { updated: true };
  });
}

export async function removeMember(orgId: string, userId: string) {
  return safeAction(async () => {
    const { supabase } = await requireOrgAccess(orgId, "admin");

    const { data: target } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single();

    if (!target) throw new ValidationError("Member not found.");

    if (target.role === "owner") {
      await requireOrgAccess(orgId, "owner");
      const { count } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("role", "owner");

      if ((count ?? 0) < 2) {
        throw new ValidationError("Cannot remove the last owner. Transfer ownership first.");
      }
    }

    await supabase
      .from("organization_members")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", userId);

    await writeAudit({
      action: "team.member.remove",
      org_id: orgId,
      target_table: "organization_members",
      target_id: userId,
      diff: { role: target.role },
    });

    revalidatePath("/settings/team");
    revalidatePath("/dashboard");

    return { removed: true };
  });
}

export async function changeRestaurantMemberRole(
  restaurantId: string,
  userId: string,
  role: "manager" | "staff"
) {
  return safeAction(async () => {
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    await supabase
      .from("restaurant_members")
      .update({ role })
      .eq("restaurant_id", restaurantId)
      .eq("user_id", userId);

    revalidatePath(`/restaurants/${restaurantId}/team`);
    return { updated: true };
  });
}

export async function removeRestaurantMember(restaurantId: string, userId: string) {
  return safeAction(async () => {
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    await supabase
      .from("restaurant_members")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("user_id", userId);

    revalidatePath(`/restaurants/${restaurantId}/team`);
    return { removed: true };
  });
}
