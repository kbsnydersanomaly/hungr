-- Allow users to choose their organisation name at sign-up.
-- The sign-up form passes it as raw_user_meta_data->>'org_name'; when absent
-- we keep the old "<Display Name>'s Organization" default.
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

  -- Slug derives from the chosen org name
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

  return new;
end $$;
