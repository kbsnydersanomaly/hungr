-- Security advisor: RLS on previously exposed tables, safer analytics insert,
-- immutable search_path on functions, RPC for invite-by-token, RPC revocations,
-- review_stats API lockdown (reads move to reviews aggregate in app).

-- ---------------------------------------------------------------------------
-- 1. Invitation lookup for accept-invite flow (anon-safe, no broad table SELECT)
-- ---------------------------------------------------------------------------
create or replace function public.get_invitation_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select to_jsonb(i) || jsonb_build_object(
    'organizations', jsonb_build_object('name', o.name)
  )
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.token = p_token
  limit 1;
$$;

comment on function public.get_invitation_by_token(text) is
  'Returns invitation + org name for a magic link. Used instead of exposing invitations to anon SELECT.';

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Row level security: tables that were missing it
-- ---------------------------------------------------------------------------
alter table public.restaurant_members enable row level security;

create policy restaurant_members_select on public.restaurant_members
  for select using (public.has_restaurant_access(restaurant_id));

create policy restaurant_members_insert on public.restaurant_members
  for insert with check (public.has_restaurant_access(restaurant_id, 'manager'));

create policy restaurant_members_update on public.restaurant_members
  for update using (public.has_restaurant_access(restaurant_id, 'manager'))
  with check (public.has_restaurant_access(restaurant_id, 'manager'));

create policy restaurant_members_delete on public.restaurant_members
  for delete using (public.has_restaurant_access(restaurant_id, 'manager'));

alter table public.invitations enable row level security;

create policy invitations_select on public.invitations
  for select using (
    public.has_org_access(org_id, 'admin')
    or (
      restaurant_id is not null
      and public.has_restaurant_access(restaurant_id, 'manager')
    )
    or lower(email) = lower((select p.email from public.profiles p where p.id = auth.uid()))
  );

create policy invitations_insert on public.invitations
  for insert with check (
    public.has_org_access(org_id, 'admin')
    and (
      restaurant_id is null
      or public.has_restaurant_access(restaurant_id, 'manager')
    )
  );

create policy invitations_update on public.invitations
  for update using (public.has_org_access(org_id, 'admin'))
  with check (public.has_org_access(org_id, 'admin'));

alter table public.special_targets enable row level security;

create policy special_targets_select on public.special_targets
  for select using (
    exists (
      select 1 from public.specials s
      where s.id = special_targets.special_id
        and (
          s.active = true
          or public.has_restaurant_access(s.restaurant_id)
        )
    )
  );

create policy special_targets_insert on public.special_targets
  for insert with check (
    exists (
      select 1 from public.specials s
      where s.id = special_targets.special_id
        and public.has_restaurant_access(s.restaurant_id, 'manager')
    )
  );

create policy special_targets_update on public.special_targets
  for update using (
    exists (
      select 1 from public.specials s
      where s.id = special_targets.special_id
        and public.has_restaurant_access(s.restaurant_id, 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.specials s
      where s.id = special_targets.special_id
        and public.has_restaurant_access(s.restaurant_id, 'manager')
    )
  );

create policy special_targets_delete on public.special_targets
  for delete using (
    exists (
      select 1 from public.specials s
      where s.id = special_targets.special_id
        and public.has_restaurant_access(s.restaurant_id, 'manager')
    )
  );

-- Internal counter rows: only service role / definer functions touch this table.
alter table public.invoice_counters enable row level security;

alter table public.notifications enable row level security;

create policy notifications_self_select on public.notifications
  for select using (user_id = auth.uid());

create policy notifications_self_update on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.analytics_daily enable row level security;

create policy analytics_daily_member_read on public.analytics_daily
  for select using (
    exists (
      select 1 from public.menus m
      where m.id = analytics_daily.menu_id
        and public.has_restaurant_access(m.restaurant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Tighten analytics_events public insert (lint: rls_policy_always_true)
-- ---------------------------------------------------------------------------
drop policy if exists analytics_public_insert on public.analytics_events;

create policy analytics_public_insert on public.analytics_events
  for insert with check (
    menu_id is not null
    and exists (
      select 1 from public.menus m
      where m.id = analytics_events.menu_id
        and m.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Lock down materialized view direct API access (lint: materialized_view_in_api)
-- ---------------------------------------------------------------------------
revoke select on public.review_stats from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Function search_path (lint: function_search_path_mutable)
-- ---------------------------------------------------------------------------
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.accept_invitation(uuid, uuid) set search_path = public, pg_temp;
alter function public.publish_branding(uuid) set search_path = public, pg_temp;
alter function public.reorder_categories(uuid, uuid[]) set search_path = public, pg_temp;
alter function public.reorder_items(uuid, uuid, uuid[]) set search_path = public, pg_temp;
alter function public.refresh_review_stats() set search_path = public, pg_temp;
alter function public.role_rank(text) set search_path = public, pg_temp;
alter function public.is_super_admin() set search_path = public, pg_temp;
alter function public.has_org_access(uuid, text) set search_path = public, pg_temp;
alter function public.has_restaurant_access(uuid, text) set search_path = public, pg_temp;
alter function public.increment_invoice_counter(uuid) set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 6. RPC exposure: revoke dangerous EXECUTE grants (lint 0028 / 0029)
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from anon, authenticated;

revoke execute on function public.accept_invitation(uuid, uuid) from anon;

revoke execute on function public.has_org_access(uuid, text) from anon;

revoke execute on function public.has_restaurant_access(uuid, text) from anon;
