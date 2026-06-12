-- Storage RLS policies
-- Buckets were created in init_schema; this adds the missing object-level policies.

-- NOTE: RLS is already enabled on storage.objects by Supabase, and the migration
-- role (postgres) does not own that table — so we do NOT run
-- `alter table storage.objects enable row level security` here (it would fail with
-- "must be owner of table objects"). Creating policies on storage.objects is
-- permitted for the migration role, which is all we need.

-- --------------------------------------------
-- menu-media (public read, manager write)
-- Path pattern: {restaurant_id}/{uuid}.{ext}
-- --------------------------------------------

drop policy if exists "menu-media manager insert" on storage.objects;
create policy "menu-media manager insert"
  on storage.objects for insert
  with check (
    bucket_id = 'menu-media'
    and public.has_restaurant_access(
      (storage.foldername(name))[1]::uuid, 'manager'
    )
  );

drop policy if exists "menu-media manager update" on storage.objects;
create policy "menu-media manager update"
  on storage.objects for update
  using (
    bucket_id = 'menu-media'
    and public.has_restaurant_access(
      (storage.foldername(name))[1]::uuid, 'manager'
    )
  );

drop policy if exists "menu-media manager delete" on storage.objects;
create policy "menu-media manager delete"
  on storage.objects for delete
  using (
    bucket_id = 'menu-media'
    and public.has_restaurant_access(
      (storage.foldername(name))[1]::uuid, 'manager'
    )
  );

-- --------------------------------------------
-- branding (public read, manager write)
-- Path pattern: {restaurant_id}/logo.{ext}
-- --------------------------------------------

drop policy if exists "branding manager insert" on storage.objects;
create policy "branding manager insert"
  on storage.objects for insert
  with check (
    bucket_id = 'branding'
    and public.has_restaurant_access(
      (storage.foldername(name))[1]::uuid, 'manager'
    )
  );

drop policy if exists "branding manager update" on storage.objects;
create policy "branding manager update"
  on storage.objects for update
  using (
    bucket_id = 'branding'
    and public.has_restaurant_access(
      (storage.foldername(name))[1]::uuid, 'manager'
    )
  );

drop policy if exists "branding manager delete" on storage.objects;
create policy "branding manager delete"
  on storage.objects for delete
  using (
    bucket_id = 'branding'
    and public.has_restaurant_access(
      (storage.foldername(name))[1]::uuid, 'manager'
    )
  );

-- --------------------------------------------
-- invoices (private, service-role / admin only)
-- Path pattern: {org_id}/{invoice_id}.pdf
-- --------------------------------------------

drop policy if exists "invoices org admin read" on storage.objects;
create policy "invoices org admin read"
  on storage.objects for select
  using (
    bucket_id = 'invoices'
    and public.has_org_access(
      (storage.foldername(name))[1]::uuid, 'admin'
    )
  );

drop policy if exists "invoices service insert" on storage.objects;
create policy "invoices service insert"
  on storage.objects for insert
  with check (bucket_id = 'invoices');

drop policy if exists "invoices service delete" on storage.objects;
create policy "invoices service delete"
  on storage.objects for delete
  using (bucket_id = 'invoices');

-- --------------------------------------------
-- private (private, owner only)
-- Path pattern: {user_id}/{uuid}.{ext}
-- --------------------------------------------

drop policy if exists "private owner read" on storage.objects;
create policy "private owner read"
  on storage.objects for select
  using (
    bucket_id = 'private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "private owner insert" on storage.objects;
create policy "private owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "private owner update" on storage.objects;
create policy "private owner update"
  on storage.objects for update
  using (
    bucket_id = 'private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "private owner delete" on storage.objects;
create policy "private owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

