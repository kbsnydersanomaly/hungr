-- is_super_admin() reads from `profiles`, which has RLS. As a plain (invoker)
-- function it re-enters the `profiles` SELECT policy, and that policy calls
-- is_super_admin() again. Most reads survive because the profiles policy
-- short-circuits on `id = auth.uid()`, but RLS paths that don't (e.g. the
-- `help-media` storage INSERT policy, whose WITH CHECK is
-- `bucket_id = 'help-media' and public.is_super_admin()`) recurse until the
-- stack overflows -> "stack depth limit exceeded" (SQLSTATE 54001).
--
-- Make it SECURITY DEFINER so the inner read bypasses RLS entirely (the same
-- pattern public.has_org_access already uses). search_path stays locked.

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select is_super_admin from profiles where id = auth.uid()), false)
$$;
