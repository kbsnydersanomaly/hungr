-- Guarded, transactional restaurant deletion.
--
-- There is no UI/API path that deletes a restaurant, and the FK graph is a
-- mix of CASCADE (menus, reviews, branding, ...), SET NULL (media,
-- audit_logs, invoices, transactions) and no FK at all (subscriptions, whose
-- scope_id is a plain uuid). delete_restaurant_cascade() removes a restaurant
-- and everything that belongs to it in one transaction, behind two guards:
--
--   1. The caller must be an owner/admin of the restaurant's org (or a super
--      admin) — same check has_org_access() performs.
--   2. A restaurant with an active paid subscription cannot be deleted; the
--      app layer tells the user to cancel billing first. The guard is
--      repeated here so no caller can bypass it.
--
-- Storage objects (menu-media bucket) are NOT reachable from SQL — the
-- deleteRestaurant server action removes them before calling this function.
-- audit_logs / invoices / transactions intentionally keep their history via
-- ON DELETE SET NULL.

create or replace function public.delete_restaurant_cascade(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from restaurants where id = p_restaurant_id;
  if v_org_id is null then
    raise exception 'restaurant not found';
  end if;

  -- Caller must be an org owner/admin (or super admin). Mirrors the guard in
  -- has_org_access(); role_rank('admin') covers owner and admin.
  if not public.has_org_access(v_org_id, 'admin') then
    raise exception 'forbidden: only organization owners and admins can delete a restaurant';
  end if;

  -- Never silently cancel a paid subscription: an active restaurant-scoped
  -- subscription blocks deletion (the app tells the user to cancel billing
  -- first). Inactive rows are removed below.
  if exists (
    select 1 from subscriptions
    where scope = 'restaurant'
      and scope_id = p_restaurant_id
      and status = 'active'
  ) then
    raise exception 'restaurant has an active subscription; cancel billing before deleting';
  end if;

  -- Dependency order. Most of these would cascade from the restaurants delete
  -- (menus → categories → menu_items, specials → special_targets, reviews,
  -- branding, branding_drafts, about_pages, invitations, restaurant_members),
  -- but deleting explicitly documents the order and survives future
  -- constraint changes.
  delete from special_targets
    where special_id in (select id from specials where restaurant_id = p_restaurant_id);
  delete from specials where restaurant_id = p_restaurant_id;

  delete from reviews where restaurant_id = p_restaurant_id;

  delete from analytics_events
    where menu_id in (select id from menus where restaurant_id = p_restaurant_id);
  delete from analytics_daily
    where menu_id in (select id from menus where restaurant_id = p_restaurant_id);
  delete from menu_items
    where menu_id in (select id from menus where restaurant_id = p_restaurant_id);
  delete from categories
    where menu_id in (select id from menus where restaurant_id = p_restaurant_id);
  delete from menus where restaurant_id = p_restaurant_id;

  delete from branding_drafts where restaurant_id = p_restaurant_id;
  delete from branding where restaurant_id = p_restaurant_id;
  delete from about_pages where restaurant_id = p_restaurant_id;

  -- media.restaurant_id is ON DELETE SET NULL, so remove the rows (and their
  -- usage links) explicitly; storage objects are deleted by the app layer.
  delete from media_usage
    where media_id in (select id from media where restaurant_id = p_restaurant_id);
  delete from media where restaurant_id = p_restaurant_id;

  delete from restaurant_members where restaurant_id = p_restaurant_id;
  delete from invitations where restaurant_id = p_restaurant_id;

  -- Restaurant-scoped billing rows. The active-status guard above guarantees
  -- only inactive subscriptions are removed here.
  delete from subscriptions
    where scope = 'restaurant' and scope_id = p_restaurant_id;

  delete from restaurants where id = p_restaurant_id;
end;
$$;

-- Only authenticated users may call it; the function itself enforces the
-- org owner/admin check.
revoke all on function public.delete_restaurant_cascade(uuid) from public;
grant execute on function public.delete_restaurant_cascade(uuid) to authenticated;
