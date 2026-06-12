-- Platform-wide settings managed from the super admin area.
-- Public read so the public menu can check flags (e.g. bottom nav) without auth.
create table if not exists platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table platform_settings enable row level security;

drop policy if exists "platform settings public read" on platform_settings;
create policy "platform settings public read"
  on platform_settings for select
  using (true);

drop policy if exists "platform settings super admin insert" on platform_settings;
create policy "platform settings super admin insert"
  on platform_settings for insert
  with check (public.is_super_admin());

drop policy if exists "platform settings super admin update" on platform_settings;
create policy "platform settings super admin update"
  on platform_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "platform settings super admin delete" on platform_settings;
create policy "platform settings super admin delete"
  on platform_settings for delete
  using (public.is_super_admin());

insert into platform_settings (key, value)
values ('public_menu_bottom_nav', '{"enabled": true}'::jsonb)
on conflict (key) do nothing;
