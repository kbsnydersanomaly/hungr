-- Skip personal-org creation for invite-only signups.
--
-- handle_new_user previously created a personal organization for EVERY new auth user.
-- Accounts created solely to accept an invite (acceptInviteAndSignUp passes
-- user_metadata.invited = true) don't need one — accept_invitation grants them the
-- invited org membership and sets default_org_id. The auto-created personal org was
-- empty junk that still showed up in the org switcher.
--
-- When raw_user_meta_data->>'invited' is true we now create only the profile row and
-- skip the org / organization_members / default_org_id block. Non-invited self-signups
-- behave exactly as before.

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
  v_invited boolean;
begin
  v_invited := coalesce((new.raw_user_meta_data->>'invited')::boolean, false);

  v_display_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User');

  insert into public.profiles (id, email, first_name, last_name, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    v_display_name
  );

  -- Invited accounts get their org context from accept_invitation; don't create a
  -- personal org for them.
  if v_invited then
    return new;
  end if;

  v_org_name := nullif(trim(coalesce(new.raw_user_meta_data->>'org_name', '')), '');
  if v_org_name is null then
    v_org_name := v_display_name || '''s Organization';
  end if;

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
