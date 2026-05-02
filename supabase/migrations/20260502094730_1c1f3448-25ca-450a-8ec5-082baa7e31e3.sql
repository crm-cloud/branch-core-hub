DROP VIEW IF EXISTS public.policy_audit;

CREATE VIEW public.policy_audit
WITH (security_invoker = true)
AS
SELECT
  c.relname                       AS table_name,
  c.relrowsecurity                AS rls_enabled,
  COALESCE(p.policy_count, 0)     AS policy_count,
  COALESCE(p.select_policies, 0)  AS select_policies,
  COALESCE(p.insert_policies, 0)  AS insert_policies,
  COALESCE(p.update_policies, 0)  AS update_policies,
  COALESCE(p.delete_policies, 0)  AS delete_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT
    schemaname, tablename,
    count(*)                                              AS policy_count,
    count(*) FILTER (WHERE cmd = 'SELECT' OR cmd = 'ALL') AS select_policies,
    count(*) FILTER (WHERE cmd = 'INSERT' OR cmd = 'ALL') AS insert_policies,
    count(*) FILTER (WHERE cmd = 'UPDATE' OR cmd = 'ALL') AS update_policies,
    count(*) FILTER (WHERE cmd = 'DELETE' OR cmd = 'ALL') AS delete_policies
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY schemaname, tablename
) p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r';

GRANT SELECT ON public.policy_audit TO authenticated;