-- ============================================
-- Hungr — Initial Schema Migration
-- ============================================

-- --------------------------------------------
-- 4.1 Identity & Tenancy
-- --------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  display_name text,
  avatar_url text,
  default_org_id uuid,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on profiles (lower(email));

-- Trigger to auto-create profile and default org on auth.users insert
create function handle_new_user() returns trigger language plpgsql security definer as $$
declare
  v_display_name text;
  v_org_id uuid;
  v_base_slug text;
  v_slug text;
begin
  v_display_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User');

  insert into public.profiles (id, email, first_name, last_name, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    v_display_name
  );

  -- Create default organization
  v_base_slug := lower(regexp_replace(regexp_replace(regexp_replace(v_display_name, '[^\w\s-]', '', 'g'), '[\s_-]+', '-', 'g'), '^-+|-+$', '', 'g'));
  if v_base_slug = '' then
    v_base_slug := 'org';
  end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := v_base_slug || '-' || floor(random() * 10000)::text;
  end loop;

  insert into public.organizations (name, slug, owner_id)
  values (v_display_name || '''s Organization', v_slug, new.id)
  returning id into v_org_id;

  insert into public.organization_members (org_id, user_id, role, invited_by)
  values (v_org_id, new.id, 'owner', new.id);

  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references profiles(id),
  plan_id uuid,
  payfast_customer_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add FK after plans table exists (done later)

create type org_role as enum ('owner', 'admin', 'manager', 'staff');

create table organization_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role org_role not null,
  invited_by uuid references profiles(id),
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index organization_members_user_idx on organization_members (user_id);

-- Add default_org_id FK after organizations exist
alter table profiles
  add constraint profiles_default_org_fk
  foreign key (default_org_id) references organizations(id) on delete set null;

create type restaurant_role as enum ('manager', 'staff');

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  slug text not null unique,
  name text not null,
  street text, city text, province text, zip text,
  status text not null default 'active',
  table_count int default 0,
  default_menu_id uuid,
  setup_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index restaurants_org_idx on restaurants (org_id);

create table restaurant_members (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role restaurant_role not null,
  joined_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  email text not null,
  org_id uuid not null references organizations(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete cascade,
  role text not null,
  invited_by uuid not null references profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_email_idx on invitations (lower(email));
create index invitations_org_idx on invitations (org_id);


-- --------------------------------------------
-- 4.2 Menus, Items, Specials
-- --------------------------------------------

create type menu_status as enum ('draft', 'published', 'archived');

create table menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  slug text not null,
  status menu_status not null default 'draft',
  is_default boolean not null default false,
  location text,
  qr_url text,
  qr_assigned boolean not null default false,
  viewing_time jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, slug)
);
create index menus_restaurant_idx on menus (restaurant_id);
create index menus_status_idx on menus (status);

-- FK deferred from restaurants
create unique index menus_one_default_per_restaurant
  on menus (restaurant_id) where is_default;

create table categories (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references menus(id) on delete cascade,
  parent_id uuid references categories(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index categories_menu_idx on categories (menu_id);
create index categories_parent_idx on categories (parent_id);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references menus(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,
  name text not null,
  description text,
  price_cents int not null,
  currency text not null default 'ZAR',
  image_url text,
  image_urls text[] not null default '{}',
  allergens text[] not null default '{}',
  labels text[] not null default '{}',
  preparations jsonb not null default '[]'::jsonb,
  variations jsonb not null default '[]'::jsonb,
  sides jsonb not null default '[]'::jsonb,
  sauces jsonb not null default '[]'::jsonb,
  pairing_ids uuid[] not null default '{}',
  display_details jsonb not null default '{}'::jsonb,
  custom_headings jsonb,
  rating numeric,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_items_menu_idx on menu_items (menu_id);
create index menu_items_category_idx on menu_items (category_id);

create type special_kind as enum ('item_discount', 'category_discount', 'combo');
create type discount_kind as enum ('percentage', 'fixed');

create table specials (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  menu_id uuid references menus(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  media_id uuid,
  kind special_kind not null,
  discount_type discount_kind,
  discount_amount_cents int,
  discount_pct numeric,
  date_from date, date_to date,
  time_from time, time_to time,
  selected_days text[],
  time_windows jsonb,
  priority int not null default 0,
  active boolean not null default true,
  custom_promotional_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index specials_restaurant_idx on specials (restaurant_id);

create table special_targets (
  id uuid primary key default gen_random_uuid(),
  special_id uuid not null references specials(id) on delete cascade,
  item_id uuid references menu_items(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  combo_item_ids uuid[]
);
create index special_targets_special_idx on special_targets (special_id);

-- Add deferred FK on restaurants.default_menu_id
alter table restaurants
  add constraint restaurants_default_menu_fk
  foreign key (default_menu_id) references menus(id) on delete set null;


-- --------------------------------------------
-- 4.3 Branding & About
-- --------------------------------------------

create table branding (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  primary_color text, secondary_color text, accent_color text,
  nav_bar_color text, background_color text,
  logo_media_id uuid,
  primary_button jsonb,
  secondary_button jsonb,
  main_heading jsonb,
  sub_heading jsonb,
  body jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

create table branding_drafts (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  primary_color text, secondary_color text, accent_color text,
  nav_bar_color text, background_color text,
  logo_media_id uuid,
  primary_button jsonb,
  secondary_button jsonb,
  main_heading jsonb,
  sub_heading jsonb,
  body jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

create table about_pages (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  about_text text,
  business_hours text,
  email text, phone text,
  main_image_url text,
  gallery_urls text[] not null default '{}',
  show_business_hours boolean not null default true,
  show_contact boolean not null default true,
  updated_at timestamptz not null default now()
);

-- --------------------------------------------
-- 4.4 Reviews
-- --------------------------------------------

create type review_status as enum ('pending', 'approved', 'rejected');

create table reviews (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  customer_name text not null,
  message text not null,
  rating int not null check (rating between 1 and 5),
  status review_status not null default 'pending',
  moderated_by uuid references profiles(id),
  moderated_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (length(customer_name) >= 2 and length(message) >= 10)
);
create index reviews_menu_item_idx on reviews (menu_item_id);
create index reviews_status_idx on reviews (status);
create index reviews_restaurant_idx on reviews (restaurant_id);

create materialized view review_stats as
  select menu_item_id,
         avg(rating)::numeric(3,2) as avg_rating,
         count(*) as total,
         jsonb_build_object(
           '1', count(*) filter (where rating=1),
           '2', count(*) filter (where rating=2),
           '3', count(*) filter (where rating=3),
           '4', count(*) filter (where rating=4),
           '5', count(*) filter (where rating=5)
         ) as distribution,
         max(created_at) as last_updated
  from reviews
  where status = 'approved'
  group by menu_item_id;
create unique index review_stats_pk on review_stats (menu_item_id);

create function refresh_review_stats() returns trigger language plpgsql as $$
begin
  refresh materialized view concurrently review_stats;
  return null;
end $$;
create trigger reviews_after_change
  after insert or update or delete on reviews
  for each statement execute function refresh_review_stats();

-- --------------------------------------------
-- 4.5 Media
-- --------------------------------------------

create table media (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references profiles(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete set null,
  bucket text not null,
  path text not null,
  url text not null,
  name text not null,
  mime text not null,
  size int not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index media_owner_idx on media (owner_user_id);
create index media_org_idx on media (org_id);

create table media_usage (
  media_id uuid not null references media(id) on delete cascade,
  used_in_table text not null,
  used_in_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (media_id, used_in_table, used_in_id)
);


-- --------------------------------------------
-- 4.6 Billing
-- --------------------------------------------

create type pricing_model as enum ('per_restaurant', 'flat_includes_n', 'custom');

create table plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  pricing_model pricing_model not null,
  base_price_cents int not null,
  additional_discount_pct numeric not null default 0,
  included_restaurants int,
  max_restaurants int,
  features jsonb not null default '{}'::jsonb,
  contact_only boolean not null default false,
  is_public boolean not null default true,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add FK on organizations.plan_id now that plans exists
alter table organizations
  add constraint organizations_plan_fk
  foreign key (plan_id) references plans(id) on delete set null;

create type subscription_scope as enum ('restaurant', 'org');
create type subscription_status as enum ('pending','active','paused','cancelled','failed');

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  scope subscription_scope not null,
  scope_id uuid not null,
  org_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references plans(id),
  status subscription_status not null default 'pending',
  amount_cents int not null,
  currency text not null default 'ZAR',
  billing_period text not null default 'monthly',
  payfast_token text,
  payfast_subscription_id text,
  m_payment_id text,
  started_at timestamptz,
  current_period_end timestamptz,
  next_billing_date timestamptz,
  paused_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index subscriptions_one_active
  on subscriptions (scope, scope_id)
  where status in ('pending','active','paused');
create index subscriptions_org_idx on subscriptions (org_id);
create index subscriptions_status_idx on subscriptions (status);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id) on delete set null,
  org_id uuid references organizations(id) on delete set null,
  restaurant_id uuid references restaurants(id) on delete set null,
  payfast_payment_id text not null,
  m_payment_id text,
  amount_gross_cents int not null,
  amount_fee_cents int not null,
  amount_net_cents int not null,
  payment_status text not null,
  email_address text,
  raw jsonb not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (payfast_payment_id)
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  org_id uuid not null references organizations(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete set null,
  subscription_id uuid not null references subscriptions(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  subtotal_cents int not null,
  total_cents int not null,
  currency text not null default 'ZAR',
  status text not null default 'draft',
  pdf_path text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index invoices_org_idx on invoices (org_id);

create table invoice_counters (
  org_id uuid primary key references organizations(id) on delete cascade,
  next_seq int not null default 1
);

-- --------------------------------------------
-- 4.7 Notifications, Audit, Analytics
-- --------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx
  on notifications (user_id) where read_at is null;

create table audit_logs (
  id bigserial primary key,
  org_id uuid references organizations(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete set null,
  actor_user_id uuid references profiles(id) on delete set null,
  acting_as_user_id uuid references profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  diff jsonb,
  ip text, user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_org_idx on audit_logs (org_id, created_at desc);
create index audit_logs_actor_idx on audit_logs (actor_user_id, created_at desc);

create table analytics_events (
  id bigserial primary key,
  menu_id uuid references menus(id) on delete cascade,
  item_id uuid references menu_items(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  session_id text,
  metadata jsonb
);
create index analytics_events_menu_time_idx
  on analytics_events (menu_id, occurred_at desc);

create table analytics_daily (
  menu_id uuid not null references menus(id) on delete cascade,
  day date not null,
  item_id uuid references menu_items(id) on delete cascade,
  views int not null default 0,
  searches int not null default 0,
  clicks int not null default 0,
  primary key (menu_id, day, item_id)
);


-- --------------------------------------------
-- 5.1 RLS Helpers
-- --------------------------------------------

create function role_rank(role text) returns int language sql immutable as $$
  select case role
    when 'owner'   then 100
    when 'admin'   then 80
    when 'manager' then 60
    when 'staff'   then 40
    else 0
  end
$$;

create function public.is_super_admin() returns boolean language sql stable as $$
  select coalesce((select is_super_admin from profiles where id = auth.uid()), false)
$$;

create function public.has_org_access(oid uuid, min_role text default 'staff')
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from organization_members
    where org_id = oid
      and user_id = auth.uid()
      and role_rank(role::text) >= role_rank(min_role)
  ) or public.is_super_admin()
$$;

create function public.has_restaurant_access(rid uuid, min_role text default 'staff')
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from organization_members om
    join restaurants r on r.org_id = om.org_id
    where r.id = rid and om.user_id = auth.uid()
      and role_rank(om.role::text) >= role_rank(min_role)
  ) or exists (
    select 1 from restaurant_members
    where restaurant_id = rid and user_id = auth.uid()
      and role_rank(role::text) >= role_rank(min_role)
  ) or public.is_super_admin()
$$;

-- --------------------------------------------
-- 5.2 RLS Policies
-- --------------------------------------------

alter table profiles enable row level security;
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or public.is_super_admin());
create policy profiles_self_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

alter table organizations enable row level security;
create policy organizations_member_read on organizations
  for select using (public.has_org_access(id));
create policy organizations_owner_update on organizations
  for update using (public.has_org_access(id, 'owner'));

alter table organization_members enable row level security;
create policy org_members_read on organization_members
  for select using (public.has_org_access(org_id));
create policy org_members_admin_write on organization_members
  for all using (public.has_org_access(org_id, 'admin'))
  with check (public.has_org_access(org_id, 'admin'));

alter table restaurants enable row level security;
create policy restaurants_public_read on restaurants
  for select using (true);
create policy restaurants_org_member_read on restaurants
  for select using (public.has_org_access(org_id));
create policy restaurants_manager_update on restaurants
  for update using (public.has_restaurant_access(id, 'manager'));
create policy restaurants_admin_insert on restaurants
  for insert with check (public.has_org_access(org_id, 'admin'));

alter table menus enable row level security;
create policy menus_public_read on menus
  for select using (status = 'published');
create policy menus_member_read on menus
  for select using (public.has_restaurant_access(restaurant_id));
create policy menus_manager_write on menus
  for all using (public.has_restaurant_access(restaurant_id, 'manager'))
  with check (public.has_restaurant_access(restaurant_id, 'manager'));

alter table menu_items enable row level security;
create policy menu_items_public_read on menu_items
  for select using (
    exists (select 1 from menus where menus.id = menu_items.menu_id and menus.status = 'published')
  );
create policy menu_items_member_read on menu_items
  for select using (
    exists (select 1 from menus
            where menus.id = menu_items.menu_id
              and public.has_restaurant_access(menus.restaurant_id))
  );
create policy menu_items_manager_write on menu_items
  for all using (
    exists (select 1 from menus
            where menus.id = menu_items.menu_id
              and public.has_restaurant_access(menus.restaurant_id, 'manager'))
  ) with check (
    exists (select 1 from menus
            where menus.id = menu_items.menu_id
              and public.has_restaurant_access(menus.restaurant_id, 'manager'))
  );

alter table categories enable row level security;
create policy categories_public_read on categories
  for select using (
    exists (select 1 from menus where menus.id = categories.menu_id and menus.status = 'published')
  );
create policy categories_member_read on categories
  for select using (
    exists (select 1 from menus where menus.id = categories.menu_id and public.has_restaurant_access(menus.restaurant_id))
  );
create policy categories_manager_write on categories
  for all using (
    exists (select 1 from menus where menus.id = categories.menu_id and public.has_restaurant_access(menus.restaurant_id, 'manager'))
  ) with check (
    exists (select 1 from menus where menus.id = categories.menu_id and public.has_restaurant_access(menus.restaurant_id, 'manager'))
  );

alter table specials enable row level security;
create policy specials_public_read on specials
  for select using (active = true);
create policy specials_member_read on specials
  for select using (public.has_restaurant_access(restaurant_id));
create policy specials_manager_write on specials
  for all using (public.has_restaurant_access(restaurant_id, 'manager'))
  with check (public.has_restaurant_access(restaurant_id, 'manager'));

alter table branding enable row level security;
create policy branding_public_read on branding
  for select using (true);
create policy branding_member_write on branding
  for all using (public.has_restaurant_access(restaurant_id, 'manager'))
  with check (public.has_restaurant_access(restaurant_id, 'manager'));

alter table branding_drafts enable row level security;
create policy branding_drafts_member on branding_drafts
  for all using (public.has_restaurant_access(restaurant_id, 'manager'))
  with check (public.has_restaurant_access(restaurant_id, 'manager'));

alter table about_pages enable row level security;
create policy about_pages_public_read on about_pages
  for select using (true);
create policy about_pages_member_write on about_pages
  for all using (public.has_restaurant_access(restaurant_id, 'manager'))
  with check (public.has_restaurant_access(restaurant_id, 'manager'));

alter table reviews enable row level security;
create policy reviews_public_read_approved on reviews
  for select using (status = 'approved');
create policy reviews_member_read_all on reviews
  for select using (public.has_restaurant_access(restaurant_id));
create policy reviews_public_submit on reviews
  for insert with check (status = 'pending');
create policy reviews_member_moderate on reviews
  for update using (public.has_restaurant_access(restaurant_id, 'manager'));
create policy reviews_member_delete on reviews
  for delete using (public.has_restaurant_access(restaurant_id, 'manager'));

alter table plans enable row level security;
create policy plans_public_read on plans
  for select using (is_public = true and active = true);
create policy plans_admin_read on plans
  for select using (public.is_super_admin());
create policy plans_admin_write on plans
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

alter table subscriptions enable row level security;
create policy subscriptions_member_read on subscriptions
  for select using (public.has_org_access(org_id, 'admin'));

alter table transactions enable row level security;
create policy transactions_member_read on transactions
  for select using (public.has_org_access(org_id, 'admin'));

alter table invoices enable row level security;
create policy invoices_member_read on invoices
  for select using (public.has_org_access(org_id, 'admin'));

alter table audit_logs enable row level security;
create policy audit_logs_org_admin_read on audit_logs
  for select using (public.has_org_access(org_id, 'admin'));

alter table analytics_events enable row level security;
create policy analytics_public_insert on analytics_events
  for insert with check (true);
create policy analytics_member_read on analytics_events
  for select using (
    exists (select 1 from menus
            where menus.id = analytics_events.menu_id
              and public.has_restaurant_access(menus.restaurant_id))
  );

alter table media enable row level security;
create policy media_owner_read on media
  for select using (owner_user_id = auth.uid() or public.has_org_access(org_id));
create policy media_manager_write on media
  for all using (public.has_restaurant_access(restaurant_id, 'manager'))
  with check (public.has_restaurant_access(restaurant_id, 'manager'));

alter table media_usage enable row level security;
create policy media_usage_member_read on media_usage
  for select using (
    exists (select 1 from media where media.id = media_usage.media_id and (media.owner_user_id = auth.uid() or public.has_org_access(media.org_id)))
  );


-- --------------------------------------------
-- 8.2 Accept Invitation Function
-- --------------------------------------------

create function accept_invitation(p_invitation_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
declare inv invitations%rowtype;
begin
  select * into inv from invitations where id = p_invitation_id for update;
  if inv.accepted_at is not null then raise exception 'already accepted'; end if;
  if inv.role in ('owner','admin','manager','staff') and inv.restaurant_id is null then
    insert into organization_members (org_id, user_id, role, invited_by)
    values (inv.org_id, p_user_id, inv.role::org_role, inv.invited_by)
    on conflict do nothing;
  end if;
  if inv.restaurant_id is not null then
    insert into restaurant_members (restaurant_id, user_id, role)
    values (inv.restaurant_id, p_user_id, inv.role::restaurant_role)
    on conflict do nothing;
  end if;
  update invitations set accepted_at = now() where id = p_invitation_id;
end $$;

-- --------------------------------------------
-- 9.3 Publish Branding Function
-- --------------------------------------------

create function publish_branding(p_restaurant_id uuid) returns void language plpgsql as $$
begin
  insert into branding (restaurant_id, primary_color, secondary_color, accent_color, nav_bar_color, background_color, logo_media_id, primary_button, secondary_button, main_heading, sub_heading, body, updated_at, updated_by)
  select restaurant_id, primary_color, secondary_color, accent_color, nav_bar_color, background_color, logo_media_id, primary_button, secondary_button, main_heading, sub_heading, body, updated_at, updated_by
  from branding_drafts where restaurant_id = p_restaurant_id
  on conflict (restaurant_id) do update set
    primary_color   = excluded.primary_color,
    secondary_color = excluded.secondary_color,
    accent_color    = excluded.accent_color,
    nav_bar_color   = excluded.nav_bar_color,
    background_color= excluded.background_color,
    logo_media_id   = excluded.logo_media_id,
    primary_button  = excluded.primary_button,
    secondary_button= excluded.secondary_button,
    main_heading    = excluded.main_heading,
    sub_heading     = excluded.sub_heading,
    body            = excluded.body,
    updated_at      = now(),
    updated_by      = excluded.updated_by;
end $$;

-- --------------------------------------------
-- Storage Buckets
-- --------------------------------------------

insert into storage.buckets (id, name, public) values
  ('menu-media', 'menu-media', true),
  ('branding', 'branding', true),
  ('invoices', 'invoices', false),
  ('private', 'private', false)
on conflict (id) do nothing;

