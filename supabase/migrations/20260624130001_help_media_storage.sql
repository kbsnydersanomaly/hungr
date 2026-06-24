-- Platform-wide help media bucket

insert into storage.buckets (id, name, public)
values ('help-media', 'help-media', true)
on conflict (id) do nothing;

-- Public read for published help images

drop policy if exists "help-media public read" on storage.objects;
create policy "help-media public read"
  on storage.objects for select
  using (bucket_id = 'help-media');

-- Super admin write access

drop policy if exists "help-media super admin insert" on storage.objects;
create policy "help-media super admin insert"
  on storage.objects for insert
  with check (bucket_id = 'help-media' and public.is_super_admin());

drop policy if exists "help-media super admin update" on storage.objects;
create policy "help-media super admin update"
  on storage.objects for update
  using (bucket_id = 'help-media' and public.is_super_admin());

drop policy if exists "help-media super admin delete" on storage.objects;
create policy "help-media super admin delete"
  on storage.objects for delete
  using (bucket_id = 'help-media' and public.is_super_admin());
