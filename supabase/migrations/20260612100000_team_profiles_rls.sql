-- Team pages join organization_members/restaurant_members -> profiles.
-- The old profiles_self_read policy redacted every other member's profile,
-- so accepted team members appeared blank. Allow reading profiles of users
-- who share an organization or restaurant.

-- Replace the self-only read policy with one that also covers org and restaurant peers.
drop policy if exists profiles_self_read on public.profiles;

create policy profiles_self_or_org_read on public.profiles
  for select using (
    id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.organization_members om1
      join public.organization_members om2 on om1.org_id = om2.org_id
      where om1.user_id = auth.uid()
        and om2.user_id = profiles.id
    )
    or exists (
      select 1 from public.restaurant_members rm
      where rm.user_id = profiles.id
        and public.has_restaurant_access(rm.restaurant_id, 'manager')
    )
  );

-- Keep the existing self-update policy untouched.
