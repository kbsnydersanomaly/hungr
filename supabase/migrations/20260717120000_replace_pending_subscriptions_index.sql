-- Allow "update payment method" replacement rows to coexist with the
-- subscription they replace.
--
-- updatePaymentMethodAction inserts a *pending* row whose m_payment_id is
-- `replace:<old-sub-id>:<old-token>:<ts>` while the old row is still active,
-- and activation later flips the new row to active around the time the old
-- one is superseded. The old partial unique index covered every
-- pending/active/paused row per (scope, scope_id), so the insert failed with
-- 23505 and the flow could never even start.
--
-- Replacement-pending rows are now excluded from the index (they are
-- temporary: abandoned ones are deleted on retry and skipped by the billing
-- page loader). Active/paused rows stay unique per scope — including
-- replacement rows once they activate.

drop index if exists public.subscriptions_one_active;

create unique index subscriptions_one_active
  on public.subscriptions (scope, scope_id)
  where (
    status in ('active', 'paused')
    or (
      status = 'pending'
      and (m_payment_id is null or m_payment_id not like 'replace:%')
    )
  );
