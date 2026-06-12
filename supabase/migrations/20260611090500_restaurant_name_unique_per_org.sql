-- Restaurant names must be unique within an organization (case-insensitive).
create unique index restaurants_org_name_unique
  on restaurants (org_id, lower(name));
