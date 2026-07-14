-- Platform-wide help media library (super-admin managed)
-- Backs the help-media storage bucket with a queryable, manageable record set
-- so super admins can browse and reuse previously uploaded help images.

create table if not exists help_media (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references profiles(id) on delete set null,
  bucket text not null default 'help-media',
  path text not null,
  url text not null,
  name text not null,
  mime text not null,
  size int not null default 0,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create index if not exists idx_help_media_created on help_media (created_at desc);

alter table help_media enable row level security;

-- Only super admins manage the help media library. Public help pages render
-- the article's screenshot URLs directly (bucket is public), so they never
-- need to read this table.
drop policy if exists "help_media super admin all" on help_media;
create policy "help_media super admin all"
  on help_media for all
  using (public.is_super_admin())
  with check (public.is_super_admin());
