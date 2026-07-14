-- Fix post-acceptance access for invited users.
--
-- Two problems this migration addresses:
--
-- 1. Restaurant-scoped invites only created a `restaurant_members` row. The whole
--    dashboard resolves context from `organization_members` (getActiveOrg), so a
--    restaurant-only invitee had no org to land in and never appeared in the org list.
--    We now also grant them a baseline `organization_members` 'staff' row so they have
--    a resolvable org context. 'staff' is the floor: has_restaurant_access still
--    requires a restaurant_members row for manager rights on other restaurants, so this
--    is not a privilege escalation.
--
-- 2. `profiles.default_org_id` was never populated, so the active-org fallback was
--    non-deterministic and brand-new invited users could land in their auto-created
--    personal org. We now set default_org_id on accept (when unset) and on signup.

create or replace function accept_invitation(p_invitation_id uuid, p_user_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare inv invitations%rowtype;
begin
  select * into inv from invitations where id = p_invitation_id for update;
  if inv.accepted_at is not null then raise exception 'already accepted'; end if;

  -- Org-level invite: grant the invited org role.
  if inv.role in ('owner','admin','manager','staff') and inv.restaurant_id is null then
    insert into organization_members (org_id, user_id, role, invited_by)
    values (inv.org_id, p_user_id, inv.role::org_role, inv.invited_by)
    on conflict do nothing;
  end if;

  -- Restaurant-scoped invite: grant the restaurant role AND a baseline org 'staff'
  -- membership so the invitee has a resolvable org context in the dashboard.
  if inv.restaurant_id is not null then
    insert into restaurant_members (restaurant_id, user_id, role)
    values (inv.restaurant_id, p_user_id, inv.role::restaurant_role)
    on conflict do nothing;

    insert into organization_members (org_id, user_id, role, invited_by)
    values (inv.org_id, p_user_id, 'staff', inv.invited_by)
    on conflict do nothing;
  end if;

  -- Prefer the invited org for users who don't yet have an explicit default.
  update profiles set default_org_id = inv.org_id
  where id = p_user_id and default_org_id is null;

  update invitations set accepted_at = now() where id = p_invitation_id;
end $$;

-- Make the auto-created personal org the user's default so the active-org fallback is
-- deterministic for self-signups too.
create or replace function handle_new_user() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_display_name text;
  v_org_name text;
  v_org_id uuid;
  v_base_slug text;
  v_slug text;
begin
  v_display_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User');
  v_org_name := nullif(trim(coalesce(new.raw_user_meta_data->>'org_name', '')), '');
  if v_org_name is null then
    v_org_name := v_display_name || '''s Organization';
  end if;

  insert into public.profiles (id, email, first_name, last_name, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    v_display_name
  );

  v_base_slug := lower(regexp_replace(regexp_replace(regexp_replace(v_org_name, '[^\w\s-]', '', 'g'), '[\s_-]+', '-', 'g'), '^-+|-+$', '', 'g'));
  if v_base_slug = '' then
    v_base_slug := 'org';
  end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := v_base_slug || '-' || floor(random() * 10000)::text;
  end loop;

  insert into public.organizations (name, slug, owner_id)
  values (v_org_name, v_slug, new.id)
  returning id into v_org_id;

  insert into public.organization_members (org_id, user_id, role, invited_by)
  values (v_org_id, new.id, 'owner', new.id);

  update public.profiles set default_org_id = v_org_id where id = new.id;

  return new;
end $$;
