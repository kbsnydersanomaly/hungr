-- Add notification preferences to profiles
alter table profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
