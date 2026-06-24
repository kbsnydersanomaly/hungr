-- Help categories and articles

create table if not exists help_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists help_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category_id uuid references help_categories(id) on delete set null,
  topics text[] not null default '{}',
  content text not null default '',
  screenshots text[] not null default '{}',
  video_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table help_categories enable row level security;
alter table help_articles enable row level security;

create policy "help_categories public read"
  on help_categories for select using (true);

create policy "help_categories super admin write"
  on help_categories for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "help_articles public read published"
  on help_articles for select using (published = true);

create policy "help_articles super admin write"
  on help_articles for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create index idx_help_articles_slug on help_articles(slug);
create index idx_help_articles_category on help_articles(category_id);
create index idx_help_articles_published on help_articles(published);
