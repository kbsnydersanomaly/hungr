-- Hungr squashed baseline (P0-E1a).
--
-- This single migration is the authoritative starting point for every Hungr
-- database. It replaces the 14 migrations 20260615110000..20260717120000,
-- which are preserved in Git history and were marked `reverted` on the hosted
-- project's ledger; this version was marked `applied` without executing.
--
-- Design: docs/superpowers/specs/2026-07-24-database-bootstrap-design.md
--
-- Section 1 (public schema) is `supabase db dump --linked` output taken from
-- project bvkiqrgkommynhdvsdut on 2026-07-24 and is not hand-edited. It only
-- ever runs against an empty database, so it is not re-runnable.
--
-- Section 2 (non-public Auth/Storage objects) is carried over from
-- 20260714150000_restore_non_public_schema_objects.sql and
-- 20260624130001_help_media_storage.sql, verified against the hosted project's
-- storage/auth dumps. Every statement there keeps its guard, so re-running this
-- file against an already-provisioned database is a no-op.


-- ===========================================================================
-- Section 1: public schema
-- ===========================================================================




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."discount_kind" AS ENUM (
    'percentage',
    'fixed'
);


ALTER TYPE "public"."discount_kind" OWNER TO "postgres";


CREATE TYPE "public"."menu_status" AS ENUM (
    'draft',
    'published',
    'archived'
);


ALTER TYPE "public"."menu_status" OWNER TO "postgres";


CREATE TYPE "public"."org_role" AS ENUM (
    'owner',
    'admin',
    'manager',
    'staff'
);


ALTER TYPE "public"."org_role" OWNER TO "postgres";


CREATE TYPE "public"."pricing_model" AS ENUM (
    'per_restaurant',
    'flat_includes_n',
    'custom'
);


ALTER TYPE "public"."pricing_model" OWNER TO "postgres";


CREATE TYPE "public"."restaurant_role" AS ENUM (
    'manager',
    'staff'
);


ALTER TYPE "public"."restaurant_role" OWNER TO "postgres";


CREATE TYPE "public"."review_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."review_status" OWNER TO "postgres";


CREATE TYPE "public"."special_kind" AS ENUM (
    'item_discount',
    'category_discount',
    'combo'
);


ALTER TYPE "public"."special_kind" OWNER TO "postgres";


CREATE TYPE "public"."subscription_scope" AS ENUM (
    'restaurant',
    'org'
);


ALTER TYPE "public"."subscription_scope" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'pending',
    'active',
    'paused',
    'cancelled',
    'failed',
    'superseded'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invitation"("p_invitation_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
  insert into public.organization_members (org_id, user_id, role, invited_by, restaurant_scoped)
  values (inv.org_id, p_user_id, v_org_role, inv.invited_by, inv.restaurant_id is not null)
  on conflict (org_id, user_id) do update set
    invited_by = coalesce(public.organization_members.invited_by, excluded.invited_by),
    restaurant_scoped = public.organization_members.restaurant_scoped and excluded.restaurant_scoped;

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


ALTER FUNCTION "public"."accept_invitation"("p_invitation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_restaurant_cascade"("p_restaurant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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

  -- Never silently cancel a paid subscription: a live restaurant-scoped
  -- subscription blocks deletion (the app tells the user to cancel billing
  -- first). 'active' is obvious; 'paused' PayFast mandates auto-resume and
  -- would bill a deleted restaurant, and 'pending' rows can be activated by
  -- an in-flight ITN webhook. Only terminal rows are removed below.
  -- Pending 'replace:%' rows are exempt: abandoned update-payment-method
  -- checkouts that never show on the billing page and can't be cancelled.
  if exists (
    select 1 from subscriptions
    where scope = 'restaurant'
      and scope_id = p_restaurant_id
      and status in ('active', 'paused', 'pending')
      and not (status = 'pending' and m_payment_id like 'replace:%')
  ) then
    raise exception 'restaurant has an active or paused subscription; cancel billing before deleting';
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

  -- Restaurant-scoped billing rows. The status guard above guarantees only
  -- terminal subscriptions are removed here. invoices.subscription_id is
  -- NO ACTION (and invoices are always written with it set), so the link
  -- must be severed first — the invoice rows themselves are kept for
  -- history (their restaurant_id goes SET NULL on the restaurants delete).
  -- The column is NOT NULL by default; it is made nullable by this
  -- migration (below) so severing the link is possible, mirroring
  -- transactions.subscription_id (ON DELETE SET NULL).
  update invoices
    set subscription_id = null
    where subscription_id in (
      select id from subscriptions
      where scope = 'restaurant' and scope_id = p_restaurant_id
    );
  delete from subscriptions
    where scope = 'restaurant' and scope_id = p_restaurant_id;

  delete from restaurants where id = p_restaurant_id;
end;
$$;


ALTER FUNCTION "public"."delete_restaurant_cascade"("p_restaurant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invitation_by_token"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select to_jsonb(i) || jsonb_build_object(
    'organizations', jsonb_build_object('name', o.name)
  )
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.token = p_token
  limit 1;
$$;


ALTER FUNCTION "public"."get_invitation_by_token"("p_token" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") IS 'Returns invitation + org name for a magic link. Used instead of exposing invitations to anon SELECT.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_display_name text;
  v_org_name text;
  v_org_id uuid;
  v_base_slug text;
  v_slug text;
begin
  v_display_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User');
  v_org_name := nullif(trim(coalesce(new.raw_user_meta_data->>'org_name', '')), '');
  if v_org_name is null then
    v_org_name := v_display_name || '''s Organization';
  end if;

  insert into public.profiles (id, email, first_name, last_name, display_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    v_display_name,
    nullif(new.raw_user_meta_data->>'phone', '')
  );

  v_base_slug := lower(regexp_replace(regexp_replace(regexp_replace(v_org_name, '[^\w\s-]', '', 'g'), '[\s_-]+', '-', 'g'), '^-+|-+$', '', 'g'));
  if v_base_slug = '' then
    v_base_slug := 'org';
  end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := v_base_slug || '-' || floor(random() * 10000)::text;
  end loop;

  insert into public.organizations (name, slug, owner_id)
  values (v_org_name, v_slug, new.id)
  returning id into v_org_id;

  insert into public.organization_members (org_id, user_id, role, invited_by)
  values (v_org_id, new.id, 'owner', new.id);

  update public.profiles set default_org_id = v_org_id where id = new.id;

  return new;
end $_$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_org_access"("oid" "uuid", "min_role" "text" DEFAULT 'staff'::"text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1 from organization_members
    where org_id = oid
      and user_id = auth.uid()
      and role_rank(role::text) >= role_rank(min_role)
  ) or public.is_super_admin()
$$;


ALTER FUNCTION "public"."has_org_access"("oid" "uuid", "min_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_restaurant_access"("rid" "uuid", "min_role" "text" DEFAULT 'staff'::"text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1 from organization_members om
    join restaurants r on r.org_id = om.org_id
    where r.id = rid and om.user_id = auth.uid()
      and role_rank(om.role::text) >= role_rank(min_role)
      and not (om.role = 'staff' and om.restaurant_scoped)
  ) or exists (
    select 1 from restaurant_members
    where restaurant_id = rid and user_id = auth.uid()
      and role_rank(role::text) >= role_rank(min_role)
  ) or public.is_super_admin()
$$;


ALTER FUNCTION "public"."has_restaurant_access"("rid" "uuid", "min_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_invoice_counter"("p_org_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  old_seq integer;
BEGIN
  -- Lock the existing counter row for this org
  SELECT next_seq INTO old_seq
  FROM invoice_counters
  WHERE org_id = p_org_id
  FOR UPDATE;

  IF FOUND THEN
    -- Increment and return the previous value
    UPDATE invoice_counters
    SET next_seq = old_seq + 1
    WHERE org_id = p_org_id;
    RETURN old_seq;
  ELSE
    -- First invoice for this org — seed counter at 2, return 1
    INSERT INTO invoice_counters (org_id, next_seq)
    VALUES (p_org_id, 2);
    RETURN 1;
  END IF;
END;
$$;


ALTER FUNCTION "public"."increment_invoice_counter"("p_org_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_invoice_counter"("p_org_id" "uuid") IS 'Atomically increments and returns the next invoice sequence number for an organization. Safe for concurrent use.';



CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select coalesce((select is_super_admin from profiles where id = auth.uid()), false)
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"("user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce((select is_super_admin from profiles where id = user_id), false)
$$;


ALTER FUNCTION "public"."is_super_admin"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_branding"("p_restaurant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."publish_branding"("p_restaurant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_review_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  refresh materialized view concurrently review_stats;
  return null;
end $$;


ALTER FUNCTION "public"."refresh_review_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_categories"("p_menu_id" "uuid", "p_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  i int;
begin
  for i in 1..array_length(p_ids, 1) loop
    update public.categories
    set sort_order = i - 1
    where id = p_ids[i] and menu_id = p_menu_id;
  end loop;
end $$;


ALTER FUNCTION "public"."reorder_categories"("p_menu_id" "uuid", "p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_items"("p_menu_id" "uuid", "p_category_id" "uuid", "p_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  i int;
begin
  for i in 1..array_length(p_ids, 1) loop
    update public.menu_items
    set sort_order = i - 1, category_id = p_category_id
    where id = p_ids[i] and menu_id = p_menu_id;
  end loop;
end $$;


ALTER FUNCTION "public"."reorder_items"("p_menu_id" "uuid", "p_category_id" "uuid", "p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."role_rank"("role" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select case role
    when 'owner'   then 100
    when 'admin'   then 80
    when 'manager' then 60
    when 'staff'   then 40
    else 0
  end
$$;


ALTER FUNCTION "public"."role_rank"("role" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."about_pages" (
    "restaurant_id" "uuid" NOT NULL,
    "about_text" "text",
    "business_hours" "text",
    "email" "text",
    "phone" "text",
    "main_image_url" "text",
    "gallery_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "show_business_hours" boolean DEFAULT true NOT NULL,
    "show_contact" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."about_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_daily" (
    "menu_id" "uuid" NOT NULL,
    "day" "date" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "views" integer DEFAULT 0 NOT NULL,
    "searches" integer DEFAULT 0 NOT NULL,
    "clicks" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."analytics_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" bigint NOT NULL,
    "menu_id" "uuid",
    "item_id" "uuid",
    "event_type" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "text",
    "metadata" "jsonb"
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."analytics_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."analytics_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."analytics_events_id_seq" OWNED BY "public"."analytics_events"."id";



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" bigint NOT NULL,
    "org_id" "uuid",
    "restaurant_id" "uuid",
    "actor_user_id" "uuid",
    "acting_as_user_id" "uuid",
    "action" "text" NOT NULL,
    "target_table" "text",
    "target_id" "uuid",
    "diff" "jsonb",
    "ip" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNED BY "public"."audit_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."branding" (
    "restaurant_id" "uuid" NOT NULL,
    "primary_color" "text",
    "secondary_color" "text",
    "accent_color" "text",
    "nav_bar_color" "text",
    "background_color" "text",
    "logo_media_id" "uuid",
    "primary_button" "jsonb",
    "secondary_button" "jsonb",
    "main_heading" "jsonb",
    "sub_heading" "jsonb",
    "body" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "logo_url" "text",
    "banner_image_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."branding" OWNER TO "postgres";


COMMENT ON COLUMN "public"."branding"."banner_image_urls" IS 'Standalone hero images shown in the public menu banner carousel.';



CREATE TABLE IF NOT EXISTS "public"."branding_drafts" (
    "restaurant_id" "uuid" NOT NULL,
    "primary_color" "text",
    "secondary_color" "text",
    "accent_color" "text",
    "nav_bar_color" "text",
    "background_color" "text",
    "logo_media_id" "uuid",
    "primary_button" "jsonb",
    "secondary_button" "jsonb",
    "main_heading" "jsonb",
    "sub_heading" "jsonb",
    "body" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "logo_url" "text",
    "banner_image_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."branding_drafts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."branding_drafts"."banner_image_urls" IS 'Draft standalone hero images shown in the public menu banner carousel.';



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."help_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "topics" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "screenshots" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "video_url" "text",
    "published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."help_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."help_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."help_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."help_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid",
    "bucket" "text" DEFAULT 'help-media'::"text" NOT NULL,
    "path" "text" NOT NULL,
    "url" "text" NOT NULL,
    "name" "text" NOT NULL,
    "mime" "text" NOT NULL,
    "size" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."help_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "email" "text" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "restaurant_id" "uuid",
    "role" "text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_counters" (
    "org_id" "uuid" NOT NULL,
    "next_seq" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."invoice_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "number" "text" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "restaurant_id" "uuid",
    "subscription_id" "uuid",
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "subtotal_cents" integer NOT NULL,
    "total_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'ZAR'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "pdf_path" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "org_id" "uuid",
    "restaurant_id" "uuid",
    "bucket" "text" NOT NULL,
    "path" "text" NOT NULL,
    "url" "text" NOT NULL,
    "name" "text" NOT NULL,
    "mime" "text" NOT NULL,
    "size" integer NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_usage" (
    "media_id" "uuid" NOT NULL,
    "used_in_table" "text" NOT NULL,
    "used_in_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."media_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'ZAR'::"text" NOT NULL,
    "image_url" "text",
    "image_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "allergens" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "labels" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "preparations" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "variations" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "sides" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "sauces" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "pairing_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "display_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "custom_headings" "jsonb",
    "rating" numeric,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menus" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "status" "public"."menu_status" DEFAULT 'draft'::"public"."menu_status" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "location" "text",
    "qr_url" "text",
    "qr_assigned" boolean DEFAULT false NOT NULL,
    "viewing_time" "jsonb",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."menus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."org_role" NOT NULL,
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "restaurant_scoped" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."organization_members"."restaurant_scoped" IS 'Only meaningful for role=staff: true limits the member to restaurants they hold restaurant_members rows for; false grants staff-rank access to every restaurant in the org.';



CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "plan_id" "uuid",
    "payfast_customer_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "pricing_model" "public"."pricing_model" NOT NULL,
    "base_price_cents" integer NOT NULL,
    "additional_discount_pct" numeric DEFAULT 0 NOT NULL,
    "included_restaurants" integer,
    "max_restaurants" integer,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "contact_only" boolean DEFAULT false NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "display_name" "text",
    "avatar_url" "text",
    "default_org_id" "uuid",
    "is_super_admin" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notification_prefs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "phone" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_members" (
    "restaurant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."restaurant_role" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."restaurant_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "street" "text",
    "city" "text",
    "province" "text",
    "zip" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "table_count" integer DEFAULT 0,
    "default_menu_id" "uuid",
    "setup_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "storage_limit_mb" integer DEFAULT 500 NOT NULL
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "customer_name" "text" NOT NULL,
    "message" "text" NOT NULL,
    "rating" integer NOT NULL,
    "status" "public"."review_status" DEFAULT 'pending'::"public"."review_status" NOT NULL,
    "moderated_by" "uuid",
    "moderated_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_check" CHECK ((("length"("customer_name") >= 2) AND ("length"("message") >= 10))),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."review_stats" AS
 SELECT "menu_item_id",
    ("avg"("rating"))::numeric(3,2) AS "avg_rating",
    "count"(*) AS "total",
    "jsonb_build_object"('1', "count"(*) FILTER (WHERE ("rating" = 1)), '2', "count"(*) FILTER (WHERE ("rating" = 2)), '3', "count"(*) FILTER (WHERE ("rating" = 3)), '4', "count"(*) FILTER (WHERE ("rating" = 4)), '5', "count"(*) FILTER (WHERE ("rating" = 5))) AS "distribution",
    "max"("created_at") AS "last_updated"
   FROM "public"."reviews"
  WHERE ("status" = 'approved'::"public"."review_status")
  GROUP BY "menu_item_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."review_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."special_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "special_id" "uuid" NOT NULL,
    "item_id" "uuid",
    "category_id" "uuid",
    "combo_item_ids" "uuid"[]
);


ALTER TABLE "public"."special_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."specials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "menu_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "media_id" "uuid",
    "kind" "public"."special_kind" NOT NULL,
    "discount_type" "public"."discount_kind",
    "discount_amount_cents" integer,
    "discount_pct" numeric,
    "date_from" "date",
    "date_to" "date",
    "time_from" time without time zone,
    "time_to" time without time zone,
    "selected_days" "text"[],
    "time_windows" "jsonb",
    "priority" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "custom_promotional_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "combo_price_cents" integer
);


ALTER TABLE "public"."specials" OWNER TO "postgres";


COMMENT ON COLUMN "public"."specials"."combo_price_cents" IS 'Flat total price (in cents) for a combo special. Only used when kind = ''combo''.';



CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scope" "public"."subscription_scope" NOT NULL,
    "scope_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "public"."subscription_status" DEFAULT 'pending'::"public"."subscription_status" NOT NULL,
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'ZAR'::"text" NOT NULL,
    "billing_period" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "payfast_token" "text",
    "payfast_subscription_id" "text",
    "m_payment_id" "text",
    "started_at" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "next_billing_date" timestamp with time zone,
    "paused_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."subscriptions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid",
    "org_id" "uuid",
    "restaurant_id" "uuid",
    "payfast_payment_id" "text" NOT NULL,
    "m_payment_id" "text",
    "amount_gross_cents" integer NOT NULL,
    "amount_fee_cents" integer NOT NULL,
    "amount_net_cents" integer NOT NULL,
    "payment_status" "text" NOT NULL,
    "email_address" "text",
    "raw" "jsonb" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."transactions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."analytics_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."analytics_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."about_pages"
    ADD CONSTRAINT "about_pages_pkey" PRIMARY KEY ("restaurant_id");



ALTER TABLE ONLY "public"."analytics_daily"
    ADD CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("menu_id", "day", "item_id");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branding_drafts"
    ADD CONSTRAINT "branding_drafts_pkey" PRIMARY KEY ("restaurant_id");



ALTER TABLE ONLY "public"."branding"
    ADD CONSTRAINT "branding_pkey" PRIMARY KEY ("restaurant_id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."help_articles"
    ADD CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."help_articles"
    ADD CONSTRAINT "help_articles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."help_categories"
    ADD CONSTRAINT "help_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."help_categories"
    ADD CONSTRAINT "help_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."help_media"
    ADD CONSTRAINT "help_media_bucket_path_key" UNIQUE ("bucket", "path");



ALTER TABLE ONLY "public"."help_media"
    ADD CONSTRAINT "help_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."invoice_counters"
    ADD CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("org_id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_number_key" UNIQUE ("number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_bucket_path_key" UNIQUE ("bucket", "path");



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_usage"
    ADD CONSTRAINT "media_usage_pkey" PRIMARY KEY ("media_id", "used_in_table", "used_in_id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menus"
    ADD CONSTRAINT "menus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menus"
    ADD CONSTRAINT "menus_restaurant_id_slug_key" UNIQUE ("restaurant_id", "slug");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("org_id", "user_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_members"
    ADD CONSTRAINT "restaurant_members_pkey" PRIMARY KEY ("restaurant_id", "user_id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."special_targets"
    ADD CONSTRAINT "special_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."specials"
    ADD CONSTRAINT "specials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_payfast_payment_id_key" UNIQUE ("payfast_payment_id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



CREATE INDEX "analytics_events_menu_time_idx" ON "public"."analytics_events" USING "btree" ("menu_id", "occurred_at" DESC);



CREATE INDEX "audit_logs_actor_idx" ON "public"."audit_logs" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "audit_logs_org_idx" ON "public"."audit_logs" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "categories_menu_idx" ON "public"."categories" USING "btree" ("menu_id");



CREATE INDEX "categories_parent_idx" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "help_articles_category_id_idx" ON "public"."help_articles" USING "btree" ("category_id");



CREATE INDEX "help_articles_slug_idx" ON "public"."help_articles" USING "btree" ("slug");



CREATE INDEX "help_categories_slug_idx" ON "public"."help_categories" USING "btree" ("slug");



CREATE INDEX "idx_help_articles_category" ON "public"."help_articles" USING "btree" ("category_id");



CREATE INDEX "idx_help_articles_published" ON "public"."help_articles" USING "btree" ("id") WHERE ("published" = true);



CREATE INDEX "idx_help_articles_slug" ON "public"."help_articles" USING "btree" ("slug");



CREATE INDEX "idx_help_articles_topics" ON "public"."help_articles" USING "gin" ("topics");



CREATE INDEX "idx_help_categories_sort" ON "public"."help_categories" USING "btree" ("sort_order");



CREATE INDEX "idx_help_media_created" ON "public"."help_media" USING "btree" ("created_at" DESC);



CREATE INDEX "invitations_email_idx" ON "public"."invitations" USING "btree" ("lower"("email"));



CREATE INDEX "invitations_org_idx" ON "public"."invitations" USING "btree" ("org_id");



CREATE INDEX "invoices_org_idx" ON "public"."invoices" USING "btree" ("org_id");



CREATE INDEX "media_org_idx" ON "public"."media" USING "btree" ("org_id");



CREATE INDEX "media_owner_idx" ON "public"."media" USING "btree" ("owner_user_id");



CREATE INDEX "menu_items_category_idx" ON "public"."menu_items" USING "btree" ("category_id");



CREATE INDEX "menu_items_menu_idx" ON "public"."menu_items" USING "btree" ("menu_id");



CREATE UNIQUE INDEX "menus_one_default_per_restaurant" ON "public"."menus" USING "btree" ("restaurant_id") WHERE "is_default";



CREATE INDEX "menus_restaurant_idx" ON "public"."menus" USING "btree" ("restaurant_id");



CREATE INDEX "menus_status_idx" ON "public"."menus" USING "btree" ("status");



CREATE INDEX "notifications_user_unread_idx" ON "public"."notifications" USING "btree" ("user_id") WHERE ("read_at" IS NULL);



CREATE INDEX "organization_members_user_idx" ON "public"."organization_members" USING "btree" ("user_id");



CREATE INDEX "profiles_email_idx" ON "public"."profiles" USING "btree" ("lower"("email"));



CREATE INDEX "restaurants_org_idx" ON "public"."restaurants" USING "btree" ("org_id");



CREATE UNIQUE INDEX "restaurants_org_name_unique" ON "public"."restaurants" USING "btree" ("org_id", "lower"("name"));



CREATE UNIQUE INDEX "review_stats_pk" ON "public"."review_stats" USING "btree" ("menu_item_id");



CREATE INDEX "reviews_menu_item_idx" ON "public"."reviews" USING "btree" ("menu_item_id");



CREATE INDEX "reviews_restaurant_idx" ON "public"."reviews" USING "btree" ("restaurant_id");



CREATE INDEX "reviews_status_idx" ON "public"."reviews" USING "btree" ("status");



CREATE INDEX "special_targets_special_idx" ON "public"."special_targets" USING "btree" ("special_id");



CREATE INDEX "specials_restaurant_idx" ON "public"."specials" USING "btree" ("restaurant_id");



CREATE UNIQUE INDEX "subscriptions_one_active" ON "public"."subscriptions" USING "btree" ("scope", "scope_id") WHERE (("status" = ANY (ARRAY['active'::"public"."subscription_status", 'paused'::"public"."subscription_status"])) OR (("status" = 'pending'::"public"."subscription_status") AND (("m_payment_id" IS NULL) OR ("m_payment_id" !~~ 'replace:%'::"text"))));



CREATE INDEX "subscriptions_org_idx" ON "public"."subscriptions" USING "btree" ("org_id");



CREATE INDEX "subscriptions_status_idx" ON "public"."subscriptions" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "reviews_after_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."reviews" FOR EACH STATEMENT EXECUTE FUNCTION "public"."refresh_review_stats"();



ALTER TABLE ONLY "public"."about_pages"
    ADD CONSTRAINT "about_pages_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_daily"
    ADD CONSTRAINT "analytics_daily_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_daily"
    ADD CONSTRAINT "analytics_daily_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_acting_as_user_id_fkey" FOREIGN KEY ("acting_as_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."branding_drafts"
    ADD CONSTRAINT "branding_drafts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branding_drafts"
    ADD CONSTRAINT "branding_drafts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."branding"
    ADD CONSTRAINT "branding_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branding"
    ADD CONSTRAINT "branding_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."help_articles"
    ADD CONSTRAINT "help_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."help_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."help_media"
    ADD CONSTRAINT "help_media_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_counters"
    ADD CONSTRAINT "invoice_counters_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id");



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."media_usage"
    ADD CONSTRAINT "media_usage_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menus"
    ADD CONSTRAINT "menus_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_default_org_fk" FOREIGN KEY ("default_org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_members"
    ADD CONSTRAINT "restaurant_members_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_members"
    ADD CONSTRAINT "restaurant_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_default_menu_fk" FOREIGN KEY ("default_menu_id") REFERENCES "public"."menus"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."special_targets"
    ADD CONSTRAINT "special_targets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."special_targets"
    ADD CONSTRAINT "special_targets_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."special_targets"
    ADD CONSTRAINT "special_targets_special_id_fkey" FOREIGN KEY ("special_id") REFERENCES "public"."specials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."specials"
    ADD CONSTRAINT "specials_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."specials"
    ADD CONSTRAINT "specials_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE "public"."about_pages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "about_pages_member_write" ON "public"."about_pages" USING ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text")) WITH CHECK ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text"));



CREATE POLICY "about_pages_public_read" ON "public"."about_pages" FOR SELECT USING (true);



ALTER TABLE "public"."analytics_daily" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_daily_member_read" ON "public"."analytics_daily" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."menus" "m"
  WHERE (("m"."id" = "analytics_daily"."menu_id") AND "public"."has_restaurant_access"("m"."restaurant_id")))));



ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_member_read" ON "public"."analytics_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."menus"
  WHERE (("menus"."id" = "analytics_events"."menu_id") AND "public"."has_restaurant_access"("menus"."restaurant_id")))));



CREATE POLICY "analytics_public_insert" ON "public"."analytics_events" FOR INSERT WITH CHECK ((("menu_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."menus" "m"
  WHERE (("m"."id" = "analytics_events"."menu_id") AND ("m"."status" = 'published'::"public"."menu_status"))))));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_org_admin_read" ON "public"."audit_logs" FOR SELECT USING ("public"."has_org_access"("org_id", 'admin'::"text"));



ALTER TABLE "public"."branding" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branding_drafts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "branding_drafts_member" ON "public"."branding_drafts" USING ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text")) WITH CHECK ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text"));



CREATE POLICY "branding_member_write" ON "public"."branding" USING ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text")) WITH CHECK ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text"));



CREATE POLICY "branding_public_read" ON "public"."branding" FOR SELECT USING (true);



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_manager_write" ON "public"."categories" USING ((EXISTS ( SELECT 1
   FROM "public"."menus"
  WHERE (("menus"."id" = "categories"."menu_id") AND "public"."has_restaurant_access"("menus"."restaurant_id", 'manager'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."menus"
  WHERE (("menus"."id" = "categories"."menu_id") AND "public"."has_restaurant_access"("menus"."restaurant_id", 'manager'::"text")))));



CREATE POLICY "categories_member_read" ON "public"."categories" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."menus"
  WHERE (("menus"."id" = "categories"."menu_id") AND "public"."has_restaurant_access"("menus"."restaurant_id")))));



CREATE POLICY "categories_public_read" ON "public"."categories" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."menus"
  WHERE (("menus"."id" = "categories"."menu_id") AND ("menus"."status" = 'published'::"public"."menu_status")))));



ALTER TABLE "public"."help_articles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "help_articles public read published" ON "public"."help_articles" FOR SELECT USING (("published" = true));



CREATE POLICY "help_articles super admin write" ON "public"."help_articles" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



ALTER TABLE "public"."help_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "help_categories public read" ON "public"."help_categories" FOR SELECT USING (true);



CREATE POLICY "help_categories super admin write" ON "public"."help_categories" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



ALTER TABLE "public"."help_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "help_media super admin all" ON "public"."help_media" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitations_insert" ON "public"."invitations" FOR INSERT WITH CHECK (("public"."has_org_access"("org_id", 'admin'::"text") AND (("restaurant_id" IS NULL) OR "public"."has_restaurant_access"("restaurant_id", 'manager'::"text"))));



CREATE POLICY "invitations_select" ON "public"."invitations" FOR SELECT USING (("public"."has_org_access"("org_id", 'admin'::"text") OR (("restaurant_id" IS NOT NULL) AND "public"."has_restaurant_access"("restaurant_id", 'manager'::"text")) OR ("lower"("email") = "lower"(( SELECT "p"."email"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))))));



CREATE POLICY "invitations_update" ON "public"."invitations" FOR UPDATE USING ("public"."has_org_access"("org_id", 'admin'::"text")) WITH CHECK ("public"."has_org_access"("org_id", 'admin'::"text"));



ALTER TABLE "public"."invoice_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_member_read" ON "public"."invoices" FOR SELECT USING ("public"."has_org_access"("org_id", 'admin'::"text"));



ALTER TABLE "public"."media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "media_manager_write" ON "public"."media" USING ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text")) WITH CHECK ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text"));



CREATE POLICY "media_owner_read" ON "public"."media" FOR SELECT USING ((("owner_user_id" = "auth"."uid"()) OR "public"."has_org_access"("org_id")));



ALTER TABLE "public"."media_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "media_usage_member_read" ON "public"."media_usage" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."media"
  WHERE (("media"."id" = "media_usage"."media_id") AND (("media"."owner_user_id" = "auth"."uid"()) OR "public"."has_org_access"("media"."org_id"))))));



ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_items_manager_write" ON "public"."menu_items" USING ((EXISTS ( SELECT 1
   FROM "public"."menus"
  WHERE (("menus"."id" = "menu_items"."menu_id") AND "public"."has_restaurant_access"("menus"."restaurant_id", 'manager'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."menus"
  WHERE (("menus"."id" = "menu_items"."menu_id") AND "public"."has_restaurant_access"("menus"."restaurant_id", 'manager'::"text")))));



CREATE POLICY "menu_items_member_read" ON "public"."menu_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."menus"
  WHERE (("menus"."id" = "menu_items"."menu_id") AND "public"."has_restaurant_access"("menus"."restaurant_id")))));



CREATE POLICY "menu_items_public_read" ON "public"."menu_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."menus"
  WHERE (("menus"."id" = "menu_items"."menu_id") AND ("menus"."status" = 'published'::"public"."menu_status")))));



ALTER TABLE "public"."menus" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menus_manager_write" ON "public"."menus" USING ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text")) WITH CHECK ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text"));



CREATE POLICY "menus_member_read" ON "public"."menus" FOR SELECT USING ("public"."has_restaurant_access"("restaurant_id"));



CREATE POLICY "menus_public_read" ON "public"."menus" FOR SELECT USING (("status" = 'published'::"public"."menu_status"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_self_select" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_self_update" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "org_members_admin_write" ON "public"."organization_members" USING ("public"."has_org_access"("org_id", 'admin'::"text")) WITH CHECK ("public"."has_org_access"("org_id", 'admin'::"text"));



CREATE POLICY "org_members_read" ON "public"."organization_members" FOR SELECT USING ("public"."has_org_access"("org_id"));



ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_member_read" ON "public"."organizations" FOR SELECT USING ("public"."has_org_access"("id"));



CREATE POLICY "organizations_owner_update" ON "public"."organizations" FOR UPDATE USING ("public"."has_org_access"("id", 'owner'::"text"));



ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plans_admin_read" ON "public"."plans" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "plans_admin_write" ON "public"."plans" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "plans_public_read" ON "public"."plans" FOR SELECT USING ((("is_public" = true) AND ("active" = true)));



CREATE POLICY "platform settings public read" ON "public"."platform_settings" FOR SELECT USING (true);



CREATE POLICY "platform settings super admin delete" ON "public"."platform_settings" FOR DELETE USING ("public"."is_super_admin"());



CREATE POLICY "platform settings super admin insert" ON "public"."platform_settings" FOR INSERT WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "platform settings super admin update" ON "public"."platform_settings" FOR UPDATE USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_self_or_org_read" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR "public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om1"
     JOIN "public"."organization_members" "om2" ON (("om1"."org_id" = "om2"."org_id")))
  WHERE (("om1"."user_id" = "auth"."uid"()) AND ("om2"."user_id" = "profiles"."id")))) OR (EXISTS ( SELECT 1
   FROM "public"."restaurant_members" "rm"
  WHERE (("rm"."user_id" = "profiles"."id") AND "public"."has_restaurant_access"("rm"."restaurant_id", 'manager'::"text"))))));



CREATE POLICY "profiles_self_update" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."restaurant_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurant_members_delete" ON "public"."restaurant_members" FOR DELETE USING ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text"));



CREATE POLICY "restaurant_members_insert" ON "public"."restaurant_members" FOR INSERT WITH CHECK ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text"));



CREATE POLICY "restaurant_members_select" ON "public"."restaurant_members" FOR SELECT USING ("public"."has_restaurant_access"("restaurant_id"));



CREATE POLICY "restaurant_members_update" ON "public"."restaurant_members" FOR UPDATE USING ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text")) WITH CHECK ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text"));



ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurants_admin_insert" ON "public"."restaurants" FOR INSERT WITH CHECK ("public"."has_org_access"("org_id", 'admin'::"text"));



CREATE POLICY "restaurants_manager_update" ON "public"."restaurants" FOR UPDATE USING ("public"."has_restaurant_access"("id", 'manager'::"text"));



CREATE POLICY "restaurants_org_member_read" ON "public"."restaurants" FOR SELECT USING ("public"."has_org_access"("org_id"));



CREATE POLICY "restaurants_public_read" ON "public"."restaurants" FOR SELECT USING (true);



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_member_delete" ON "public"."reviews" FOR DELETE USING ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text"));



CREATE POLICY "reviews_member_moderate" ON "public"."reviews" FOR UPDATE USING ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text"));



CREATE POLICY "reviews_member_read_all" ON "public"."reviews" FOR SELECT USING ("public"."has_restaurant_access"("restaurant_id"));



CREATE POLICY "reviews_public_read_approved" ON "public"."reviews" FOR SELECT USING (("status" = 'approved'::"public"."review_status"));



CREATE POLICY "reviews_public_submit" ON "public"."reviews" FOR INSERT WITH CHECK (("status" = 'pending'::"public"."review_status"));



ALTER TABLE "public"."special_targets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "special_targets_delete" ON "public"."special_targets" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."specials" "s"
  WHERE (("s"."id" = "special_targets"."special_id") AND "public"."has_restaurant_access"("s"."restaurant_id", 'manager'::"text")))));



CREATE POLICY "special_targets_insert" ON "public"."special_targets" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."specials" "s"
  WHERE (("s"."id" = "special_targets"."special_id") AND "public"."has_restaurant_access"("s"."restaurant_id", 'manager'::"text")))));



CREATE POLICY "special_targets_select" ON "public"."special_targets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."specials" "s"
  WHERE (("s"."id" = "special_targets"."special_id") AND (("s"."active" = true) OR "public"."has_restaurant_access"("s"."restaurant_id"))))));



CREATE POLICY "special_targets_update" ON "public"."special_targets" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."specials" "s"
  WHERE (("s"."id" = "special_targets"."special_id") AND "public"."has_restaurant_access"("s"."restaurant_id", 'manager'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."specials" "s"
  WHERE (("s"."id" = "special_targets"."special_id") AND "public"."has_restaurant_access"("s"."restaurant_id", 'manager'::"text")))));



ALTER TABLE "public"."specials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "specials_manager_write" ON "public"."specials" USING ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text")) WITH CHECK ("public"."has_restaurant_access"("restaurant_id", 'manager'::"text"));



CREATE POLICY "specials_member_read" ON "public"."specials" FOR SELECT USING ("public"."has_restaurant_access"("restaurant_id"));



CREATE POLICY "specials_public_read" ON "public"."specials" FOR SELECT USING (("active" = true));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_admin_insert" ON "public"."subscriptions" FOR INSERT WITH CHECK ("public"."has_org_access"("org_id", 'admin'::"text"));



CREATE POLICY "subscriptions_admin_update" ON "public"."subscriptions" FOR UPDATE USING ("public"."has_org_access"("org_id", 'admin'::"text"));



CREATE POLICY "subscriptions_member_read" ON "public"."subscriptions" FOR SELECT USING ("public"."has_org_access"("org_id", 'admin'::"text"));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_admin_insert" ON "public"."transactions" FOR INSERT WITH CHECK ((("org_id" IS NULL) OR "public"."has_org_access"("org_id", 'admin'::"text")));



CREATE POLICY "transactions_admin_update" ON "public"."transactions" FOR UPDATE USING ((("org_id" IS NULL) OR "public"."has_org_access"("org_id", 'admin'::"text")));



CREATE POLICY "transactions_member_read" ON "public"."transactions" FOR SELECT USING ("public"."has_org_access"("org_id", 'admin'::"text"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."accept_invitation"("p_invitation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invitation"("p_invitation_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_restaurant_cascade"("p_restaurant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_restaurant_cascade"("p_restaurant_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_org_access"("oid" "uuid", "min_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_org_access"("oid" "uuid", "min_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_restaurant_access"("rid" "uuid", "min_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_restaurant_access"("rid" "uuid", "min_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_invoice_counter"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_invoice_counter"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_invoice_counter"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."publish_branding"("p_restaurant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."publish_branding"("p_restaurant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."publish_branding"("p_restaurant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_review_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_review_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_review_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_categories"("p_menu_id" "uuid", "p_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_categories"("p_menu_id" "uuid", "p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_categories"("p_menu_id" "uuid", "p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_items"("p_menu_id" "uuid", "p_category_id" "uuid", "p_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_items"("p_menu_id" "uuid", "p_category_id" "uuid", "p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_items"("p_menu_id" "uuid", "p_category_id" "uuid", "p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."role_rank"("role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."role_rank"("role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."role_rank"("role" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."about_pages" TO "anon";
GRANT ALL ON TABLE "public"."about_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."about_pages" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_daily" TO "anon";
GRANT ALL ON TABLE "public"."analytics_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_daily" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."analytics_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."analytics_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."analytics_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."branding" TO "anon";
GRANT ALL ON TABLE "public"."branding" TO "authenticated";
GRANT ALL ON TABLE "public"."branding" TO "service_role";



GRANT ALL ON TABLE "public"."branding_drafts" TO "anon";
GRANT ALL ON TABLE "public"."branding_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."branding_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."help_articles" TO "anon";
GRANT ALL ON TABLE "public"."help_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."help_articles" TO "service_role";



GRANT ALL ON TABLE "public"."help_categories" TO "anon";
GRANT ALL ON TABLE "public"."help_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."help_categories" TO "service_role";



GRANT ALL ON TABLE "public"."help_media" TO "anon";
GRANT ALL ON TABLE "public"."help_media" TO "authenticated";
GRANT ALL ON TABLE "public"."help_media" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_counters" TO "anon";
GRANT ALL ON TABLE "public"."invoice_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_counters" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."media" TO "anon";
GRANT ALL ON TABLE "public"."media" TO "authenticated";
GRANT ALL ON TABLE "public"."media" TO "service_role";



GRANT ALL ON TABLE "public"."media_usage" TO "anon";
GRANT ALL ON TABLE "public"."media_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."media_usage" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."menus" TO "anon";
GRANT ALL ON TABLE "public"."menus" TO "authenticated";
GRANT ALL ON TABLE "public"."menus" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_members" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_members" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_members" TO "service_role";



GRANT ALL ON TABLE "public"."restaurants" TO "anon";
GRANT ALL ON TABLE "public"."restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."review_stats" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."review_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."review_stats" TO "service_role";



GRANT ALL ON TABLE "public"."special_targets" TO "anon";
GRANT ALL ON TABLE "public"."special_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."special_targets" TO "service_role";



GRANT ALL ON TABLE "public"."specials" TO "anon";
GRANT ALL ON TABLE "public"."specials" TO "authenticated";
GRANT ALL ON TABLE "public"."specials" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

































-- ===========================================================================
-- Section 2: non-public Auth/Storage objects
--
-- `supabase db dump` never emits these, and the Supabase-managed `auth` and
-- `storage` schemas must not be dumped wholesale (their definitions differ
-- across platform versions and would conflict with a fresh project's own
-- managed objects). Only Hungr's objects inside them are carried here.
--
-- Section 1 leaves search_path empty, so everything below is schema-qualified.
-- ===========================================================================

-- 2.1 Profile-provisioning trigger on auth.users.
--     Without it, new signups get no profiles row and every insert that
--     references profiles (organizations.owner_id, etc.) fails.
--     Guarded by function identity rather than trigger name so a remote
--     trigger with a different name is never duplicated.

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and t.tgfoid = 'public.handle_new_user'::regproc
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- 2.2 Section 1 creates review_stats WITH NO DATA, but the
--     reviews_after_change trigger refreshes it CONCURRENTLY — which errors on
--     an unpopulated matview, breaking every write (and cascading delete) that
--     touches reviews. Populate it once; no-op when already populated.

do $$
begin
  if not (select relispopulated from pg_class where oid = 'public.review_stats'::regclass) then
    refresh materialized view public.review_stats;
  end if;
end $$;

-- 2.3 Storage buckets (rows in storage.buckets are data, not schema).
--     All five hosted buckets, including help-media — which was previously
--     created only by 20260624130001 and would otherwise be lost by the squash,
--     silently breaking help-article image upload on every fresh database.
--     Hosted has no file_size_limit or allowed_mime_types on any bucket.

insert into storage.buckets (id, name, public)
values
  ('menu-media', 'menu-media', true),
  ('branding', 'branding', true),
  ('invoices', 'invoices', false),
  ('private', 'private', false),
  ('help-media', 'help-media', true)
on conflict (id) do nothing;

-- 2.4 Storage policies for those buckets (17 total, matching hosted exactly).

drop policy if exists "menu-media manager insert" on storage.objects;
create policy "menu-media manager insert"
  on storage.objects for insert
  with check (bucket_id = 'menu-media' and public.has_restaurant_access((storage.foldername(name))[1]::uuid, 'manager'));

drop policy if exists "menu-media manager update" on storage.objects;
create policy "menu-media manager update"
  on storage.objects for update
  using (bucket_id = 'menu-media' and public.has_restaurant_access((storage.foldername(name))[1]::uuid, 'manager'));

drop policy if exists "menu-media manager delete" on storage.objects;
create policy "menu-media manager delete"
  on storage.objects for delete
  using (bucket_id = 'menu-media' and public.has_restaurant_access((storage.foldername(name))[1]::uuid, 'manager'));

drop policy if exists "branding manager insert" on storage.objects;
create policy "branding manager insert"
  on storage.objects for insert
  with check (bucket_id = 'branding' and public.has_restaurant_access((storage.foldername(name))[1]::uuid, 'manager'));

drop policy if exists "branding manager update" on storage.objects;
create policy "branding manager update"
  on storage.objects for update
  using (bucket_id = 'branding' and public.has_restaurant_access((storage.foldername(name))[1]::uuid, 'manager'));

drop policy if exists "branding manager delete" on storage.objects;
create policy "branding manager delete"
  on storage.objects for delete
  using (bucket_id = 'branding' and public.has_restaurant_access((storage.foldername(name))[1]::uuid, 'manager'));

drop policy if exists "invoices org admin read" on storage.objects;
create policy "invoices org admin read"
  on storage.objects for select
  using (bucket_id = 'invoices' and public.has_org_access((storage.foldername(name))[1]::uuid, 'admin'));

drop policy if exists "invoices service insert" on storage.objects;
create policy "invoices service insert"
  on storage.objects for insert
  with check (bucket_id = 'invoices');

drop policy if exists "invoices service delete" on storage.objects;
create policy "invoices service delete"
  on storage.objects for delete
  using (bucket_id = 'invoices');

drop policy if exists "private owner read" on storage.objects;
create policy "private owner read"
  on storage.objects for select
  using (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "private owner insert" on storage.objects;
create policy "private owner insert"
  on storage.objects for insert
  with check (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "private owner update" on storage.objects;
create policy "private owner update"
  on storage.objects for update
  using (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "private owner delete" on storage.objects;
create policy "private owner delete"
  on storage.objects for delete
  using (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "help-media public read" on storage.objects;
create policy "help-media public read"
  on storage.objects for select
  using (bucket_id = 'help-media');

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
