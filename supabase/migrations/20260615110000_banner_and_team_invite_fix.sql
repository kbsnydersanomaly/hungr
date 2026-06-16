-- Add homepage banner images to branding tables
alter table branding
  add column if not exists banner_image_urls text[] not null default '{}';

alter table branding_drafts
  add column if not exists banner_image_urls text[] not null default '{}';

comment on column branding.banner_image_urls is
  'Standalone hero images shown in the public menu banner carousel.';
comment on column branding_drafts.banner_image_urls is
  'Draft standalone hero images shown in the public menu banner carousel.';

-- Update publish_branding to copy banner images from draft to live.
create or replace function public.publish_branding(p_restaurant_id uuid)
returns void language plpgsql as $$
begin
  insert into public.branding (
    restaurant_id,
    primary_color, secondary_color, accent_color,
    nav_bar_color, background_color,
    logo_media_id, logo_url,
    banner_image_urls,
    primary_button, secondary_button,
    main_heading, sub_heading, body,
    updated_at, updated_by
  )
  select
    restaurant_id,
    primary_color, secondary_color, accent_color,
    nav_bar_color, background_color,
    logo_media_id, logo_url,
    banner_image_urls,
    primary_button, secondary_button,
    main_heading, sub_heading, body,
    now(), updated_by
  from public.branding_drafts
  where restaurant_id = p_restaurant_id
  on conflict (restaurant_id) do update set
    primary_color    = excluded.primary_color,
    secondary_color  = excluded.secondary_color,
    accent_color     = excluded.accent_color,
    nav_bar_color    = excluded.nav_bar_color,
    background_color = excluded.background_color,
    logo_media_id    = excluded.logo_media_id,
    logo_url         = excluded.logo_url,
    banner_image_urls= excluded.banner_image_urls,
    primary_button   = excluded.primary_button,
    secondary_button = excluded.secondary_button,
    main_heading     = excluded.main_heading,
    sub_heading      = excluded.sub_heading,
    body             = excluded.body,
    updated_at       = now(),
    updated_by       = excluded.updated_by;
end $$;

-- Fix team invitations: restaurant-scoped invites must also give the user
-- organization membership so they can see the restaurant in the dashboard.
-- Also guard against invalid owner/admin roles being cast to restaurant_role.
create or replace function public.accept_invitation(p_invitation_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  inv invitations%rowtype;
  v_org_role org_role;
  v_restaurant_role restaurant_role;
begin
  select * into inv from public.invitations where id = p_invitation_id for update;

  if inv.id is null then
    raise exception 'Invitation not found';
  end if;

  if inv.accepted_at is not null then
    raise exception 'Invitation already accepted';
  end if;

  if inv.revoked_at is not null then
    raise exception 'Invitation has been revoked';
  end if;

  if inv.expires_at < now() then
    raise exception 'Invitation has expired';
  end if;

  -- Resolve the org role. For restaurant-scoped invites the user gets a base
  -- org role of staff; the restaurant-specific role is stored separately.
  if inv.restaurant_id is not null then
    if inv.role not in ('manager', 'staff') then
      raise exception 'Restaurant invitations only support manager or staff roles';
    end if;
    v_org_role := 'staff';
    v_restaurant_role := inv.role::restaurant_role;
  else
    v_org_role := inv.role::org_role;
  end if;

  -- Always ensure org membership, but never downgrade an existing role.
  insert into public.organization_members (org_id, user_id, role, invited_by)
  values (inv.org_id, p_user_id, v_org_role, inv.invited_by)
  on conflict (org_id, user_id) do update set
    invited_by = coalesce(public.organization_members.invited_by, excluded.invited_by);

  -- Add restaurant-specific membership when applicable.
  if inv.restaurant_id is not null then
    insert into public.restaurant_members (restaurant_id, user_id, role)
    values (inv.restaurant_id, p_user_id, v_restaurant_role)
    on conflict (restaurant_id, user_id) do update set
      role = excluded.role;
  end if;

  update public.invitations
  set accepted_at = now()
  where id = p_invitation_id;
end $$;
