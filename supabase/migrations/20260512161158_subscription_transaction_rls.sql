-- Add missing INSERT/UPDATE policies for subscriptions and transactions
-- Previously only SELECT policies existed, causing RLS failures when
-- server actions tried to create subscriptions or transactions.

-- subscriptions: org admins can insert and update
alter table subscriptions force row level security;

create policy subscriptions_admin_insert on subscriptions
  for insert with check (public.has_org_access(org_id, 'admin'));

create policy subscriptions_admin_update on subscriptions
  for update using (public.has_org_access(org_id, 'admin'));

-- transactions: org admins can insert and update
-- (webhook handler uses service_role which bypasses RLS anyway)
alter table transactions force row level security;

create policy transactions_admin_insert on transactions
  for insert with check (org_id is null or public.has_org_access(org_id, 'admin'));

create policy transactions_admin_update on transactions
  for update using (org_id is null or public.has_org_access(org_id, 'admin'));
