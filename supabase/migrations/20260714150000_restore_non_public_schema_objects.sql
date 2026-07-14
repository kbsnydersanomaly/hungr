-- Restore objects that live outside the `public` schema and were therefore
-- lost when a local environment is rebuilt from supabase/schemas/baseline.sql
-- (the baseline is a `public`-schema-only dump). Everything here already
-- exists in production, so every statement is guarded to be a no-op there.

-- 1. Profile-provisioning trigger on auth.users.
--    Without it, new signups get no profiles row and every insert that
--    references profiles (organizations.owner_id, etc.) fails.
--    Guarded by function identity rather than trigger name so a remote
--    trigger with a different name is never duplicated.

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and t.tgfoid = 'public.handle_new_user'::regproc
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- 2. The baseline creates review_stats WITH NO DATA, but the
--    reviews_after_change trigger refreshes it CONCURRENTLY — which errors on
--    an unpopulated matview, breaking every write (and cascading delete) that
--    touches reviews. Populate it once; no-op when already populated.

do $$
begin
  if not (select relispopulated from pg_class where oid = 'public.review_stats'::regclass) then
    refresh materialized view public.review_stats;
  end if;
end $$;

-- 3. Storage buckets (rows in storage.buckets are data, not schema).

insert into storage.buckets (id, name, public)
values
  ('menu-media', 'menu-media', true),
  ('branding', 'branding', true),
  ('invoices', 'invoices', false),
  ('private', 'private', false)
on conflict (id) do nothing;

-- 4. Storage policies for those buckets (verbatim from production).

drop policy if exists "menu-media manager insert" on storage.objects;
create policy "menu-media manager insert"
  on storage.objects for insert
  with check (bucket_id = 'menu-media' and public.has_restaurant_access((storage.foldername(name))[1]::uuid, 'manager'));

drop policy if exists "menu-media manager update" on storage.objects;
create policy "menu-media manager update"
  on storage.objects for update
  using (bucket_id = 'menu-media' and public.has_restaurant_access((storage.foldername(name))[1]::uuid, 'manager'));

drop policy if exists "menu-media manager delete" on storage.objects;
create policy "menu-media manager delete"
  on storage.objects for delete
  using (bucket_id = 'menu-media' and public.has_restaurant_access((storage.foldername(name))[1]::uuid, 'manager'));

drop policy if exists "branding manager insert" on storage.objects;
create policy "branding manager insert"
  on storage.objects for insert
  with check (bucket_id = 'branding' and public.has_restaurant_access((storage.foldername(name))[1]::uuid, 'manager'));

drop policy if exists "branding manager update" on storage.objects;
create policy "branding manager update"
  on storage.objects for update
  using (bucket_id = 'branding' and public.has_restaurant_access((storage.foldername(name))[1]::uuid, 'manager'));

drop policy if exists "branding manager delete" on storage.objects;
create policy "branding manager delete"
  on storage.objects for delete
  using (bucket_id = 'branding' and public.has_restaurant_access((storage.foldername(name))[1]::uuid, 'manager'));

drop policy if exists "invoices org admin read" on storage.objects;
create policy "invoices org admin read"
  on storage.objects for select
  using (bucket_id = 'invoices' and public.has_org_access((storage.foldername(name))[1]::uuid, 'admin'));

drop policy if exists "invoices service insert" on storage.objects;
create policy "invoices service insert"
  on storage.objects for insert
  with check (bucket_id = 'invoices');

drop policy if exists "invoices service delete" on storage.objects;
create policy "invoices service delete"
  on storage.objects for delete
  using (bucket_id = 'invoices');

drop policy if exists "private owner read" on storage.objects;
create policy "private owner read"
  on storage.objects for select
  using (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "private owner insert" on storage.objects;
create policy "private owner insert"
  on storage.objects for insert
  with check (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "private owner update" on storage.objects;
create policy "private owner update"
  on storage.objects for update
  using (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "private owner delete" on storage.objects;
create policy "private owner delete"
  on storage.objects for delete
  using (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text);
