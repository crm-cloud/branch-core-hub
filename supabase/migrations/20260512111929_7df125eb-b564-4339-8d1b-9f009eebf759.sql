
DROP VIEW IF EXISTS public.product_batch_availability;

CREATE VIEW public.product_batch_availability
WITH (security_invoker = true)
AS
SELECT
  product_id,
  branch_id,
  COALESCE(SUM(quantity_remaining), 0)::integer AS available_quantity,
  MIN(exp_date) FILTER (WHERE status = 'active' AND quantity_remaining > 0
                          AND (exp_date IS NULL OR exp_date >= CURRENT_DATE)) AS nearest_expiry,
  COUNT(*) FILTER (WHERE status = 'active' AND quantity_remaining > 0
                          AND (exp_date IS NULL OR exp_date >= CURRENT_DATE))::integer AS active_batch_count
FROM public.product_batches
WHERE status = 'active'
  AND quantity_remaining > 0
  AND (exp_date IS NULL OR exp_date >= CURRENT_DATE)
GROUP BY product_id, branch_id;

GRANT SELECT ON public.product_batch_availability TO authenticated;
