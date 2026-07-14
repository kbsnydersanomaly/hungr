-- Staff can be either organisation-wide (see every restaurant in the org at
-- staff rank) or restaurant-scoped (see only the restaurants they hold a
-- restaurant_members row for). The flag lives on the org membership so the
-- choice is explicit — inferring it from "has any restaurant_members rows"
-- would silently promote a scoped member to org-wide if their restaurant
-- were deleted.

alter table organization_members
  add column if not exists restaurant_scoped boolean not null default false;

comment on column organization_members.restaurant_scoped is
  'Only meaningful for role=staff: true limits the member to restaurants they hold restaurant_members rows for; false grants staff-rank access to every restaurant in the org.';

-- Backfill: staff who came in through restaurant-scoped invites (they hold
-- restaurant_members rows in the same org) keep their scoped behavior.
update organization_members om
set restaurant_scoped = true
where om.role = 'staff'
  and exists (
    select 1
    from restaurant_members rm
    join restaurants r on r.id = rm.restaurant_id
    where rm.user_id = om.user_id
      and r.org_id = om.org_id
  );

-- Scoped staff no longer get org-wide reads through the org-membership branch;
-- their access comes exclusively from restaurant_members. This backs the RLS
-- policies on menus/reviews/specials/etc., closing the gap where a scoped
-- staff JWT could read every restaurant in the org via PostgREST.
create or replace function public.has_restaurant_access(rid uuid, min_role text default 'staff'::text)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from organization_members om
    join restaurants r on r.org_id = om.org_id
    where r.id = rid and om.user_id = auth.uid()
      and role_rank(om.role::text) >= role_rank(min_role)
      and not (om.role = 'staff' and om.restaurant_scoped)
  ) or exists (
    select 1 from restaurant_members
    where restaurant_id = rid and user_id = auth.uid()
      and role_rank(role::text) >= role_rank(min_role)
  ) or public.is_super_admin()
$$;

-- accept_invitation: restaurant-scoped invites mark the baseline org
-- membership as scoped. On conflict the flag can only relax (an org-wide
-- invite upgrades a scoped member to org-wide; a scoped invite never
-- restricts an existing org-wide member).
create or replace function public.accept_invitation(p_invitation_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  inv invitations%rowtype;
  v_org_role org_role;
  v_restaurant_role restaurant_role;
begin
  select * into inv from public.invitations where id = p_invitation_id for update;

  if inv.id is null then
    raise exception 'Invitation not found';
  end if;

  if inv.accepted_at is not null then
    raise exception 'Invitation already accepted';
  end if;

  if inv.revoked_at is not null then
    raise exception 'Invitation has been revoked';
  end if;

  if inv.expires_at < now() then
    raise exception 'Invitation has expired';
  end if;

  -- Resolve the org role. For restaurant-scoped invites the user gets a base
  -- org role of staff; the restaurant-specific role is stored separately.
  if inv.restaurant_id is not null then
    if inv.role not in ('manager', 'staff') then
      raise exception 'Restaurant invitations only support manager or staff roles';
    end if;
    v_org_role := 'staff';
    v_restaurant_role := inv.role::restaurant_role;
  else
    v_org_role := inv.role::org_role;
  end if;

  -- Always ensure org membership, but never downgrade an existing role.
  insert into public.organization_members (org_id, user_id, role, invited_by, restaurant_scoped)
  values (inv.org_id, p_user_id, v_org_role, inv.invited_by, inv.restaurant_id is not null)
  on conflict (org_id, user_id) do update set
    invited_by = coalesce(public.organization_members.invited_by, excluded.invited_by),
    restaurant_scoped = public.organization_members.restaurant_scoped and excluded.restaurant_scoped;

  -- Add restaurant-specific membership when applicable.
  if inv.restaurant_id is not null then
    insert into public.restaurant_members (restaurant_id, user_id, role)
    values (inv.restaurant_id, p_user_id, v_restaurant_role)
    on conflict (restaurant_id, user_id) do update set
      role = excluded.role;
  end if;

  update public.invitations
  set accepted_at = now()
  where id = p_invitation_id;
end $$;
