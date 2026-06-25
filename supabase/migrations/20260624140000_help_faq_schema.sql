-- Help / FAQ schema
-- Categories group articles; articles can be searched/filtered by topic and are
-- only publicly visible when published. Super admins have full write access.

create table if not exists help_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists help_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references help_categories(id) on delete set null,
  title text not null,
  slug text unique not null,
  topics text[] default '{}',
  content text not null default '',
  screenshots text[] default '{}',
  video_url text,
  published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Helper used by RLS policies (overloads the existing no-arg version).
create or replace function public.is_super_admin(user_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce((select is_super_admin from profiles where id = user_id), false)
$$;

alter table help_categories enable row level security;
alter table help_articles enable row level security;

-- Public users can read all categories.
drop policy if exists "help_categories public read" on help_categories;
create policy "help_categories public read"
  on help_categories for select
  using (true);

-- Super admins can manage categories.
drop policy if exists "help_categories super admin write" on help_categories;
create policy "help_categories super admin write"
  on help_categories for all
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- Public users can only read published articles.
drop policy if exists "help_articles public read published" on help_articles;
create policy "help_articles public read published"
  on help_articles for select
  using (published = true);

-- Super admins can manage articles (published or not).
drop policy if exists "help_articles super admin write" on help_articles;
create policy "help_articles super admin write"
  on help_articles for all
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- Indexes requested by the implementation spec.
create index if not exists help_articles_slug_idx on help_articles(slug);
create index if not exists help_articles_category_id_idx on help_articles(category_id);
create index if not exists help_categories_slug_idx on help_categories(slug);
