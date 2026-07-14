-- Per-restaurant media storage quota. Restaurants get a fixed amount of storage
-- (default 500 MB) that a super admin can adjust. Usage is computed from the
-- existing media.size column (SUM of bytes per restaurant), so no separate
-- accounting table is needed.

alter table restaurants
  add column if not exists storage_limit_mb integer not null default 500;
