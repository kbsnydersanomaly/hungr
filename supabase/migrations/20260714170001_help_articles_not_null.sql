-- The help_articles migration (20260624130000) declares these columns NOT
-- NULL with defaults, but production's tables predate that and have them
-- nullable — drift the baseline dump made visible. Backfill and enforce the
-- intended constraints so generated types stay strict.

update help_categories set sort_order = 0 where sort_order is null;
update help_categories set created_at = now() where created_at is null;
update help_categories set updated_at = now() where updated_at is null;

alter table help_categories
  alter column sort_order set default 0,
  alter column sort_order set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

update help_articles set topics = '{}' where topics is null;
update help_articles set screenshots = '{}' where screenshots is null;
update help_articles set published = false where published is null;
update help_articles set created_at = now() where created_at is null;
update help_articles set updated_at = now() where updated_at is null;

alter table help_articles
  alter column topics set default '{}',
  alter column topics set not null,
  alter column screenshots set default '{}',
  alter column screenshots set not null,
  alter column published set default false,
  alter column published set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;
