-- Store the uploaded logo URL directly on branding rows.
alter table branding add column if not exists logo_url text;
alter table branding_drafts add column if not exists logo_url text;

create or replace function publish_branding(p_restaurant_id uuid) returns void language plpgsql as $$
begin
  insert into branding (restaurant_id, primary_color, secondary_color, accent_color, nav_bar_color, background_color, logo_media_id, logo_url, primary_button, secondary_button, main_heading, sub_heading, body, updated_at, updated_by)
  select restaurant_id, primary_color, secondary_color, accent_color, nav_bar_color, background_color, logo_media_id, logo_url, primary_button, secondary_button, main_heading, sub_heading, body, updated_at, updated_by
  from branding_drafts where restaurant_id = p_restaurant_id
  on conflict (restaurant_id) do update set
    primary_color   = excluded.primary_color,
    secondary_color = excluded.secondary_color,
    accent_color    = excluded.accent_color,
    nav_bar_color   = excluded.nav_bar_color,
    background_color= excluded.background_color,
    logo_media_id   = excluded.logo_media_id,
    logo_url        = excluded.logo_url,
    primary_button  = excluded.primary_button,
    secondary_button= excluded.secondary_button,
    main_heading    = excluded.main_heading,
    sub_heading     = excluded.sub_heading,
    body            = excluded.body,
    updated_at      = now(),
    updated_by      = excluded.updated_by;
end $$;

alter function public.publish_branding(uuid) set search_path = public, pg_temp;
