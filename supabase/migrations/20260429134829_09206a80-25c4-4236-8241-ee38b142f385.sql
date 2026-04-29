
DROP VIEW IF EXISTS public.v_template_with_meta_status;

CREATE VIEW public.v_template_with_meta_status
WITH (security_invoker = true)
AS
SELECT
  t.id,
  t.branch_id,
  t.name,
  t.type,
  t.subject,
  t.content,
  t.trigger_event,
  t.is_active,
  t.created_at,
  t.updated_at,
  t.meta_template_name,
  t.meta_template_status,
  t.meta_rejection_reason,
  CASE
    WHEN t.type <> 'whatsapp' THEN 'not_applicable'
    WHEN wt.status = 'APPROVED' THEN 'approved'
    WHEN wt.status = 'PENDING'  THEN 'pending'
    WHEN wt.status = 'REJECTED' THEN 'rejected'
    WHEN wt.status IN ('PAUSED','DISABLED') THEN 'paused'
    WHEN t.meta_template_name IS NULL THEN 'draft'
    WHEN UPPER(COALESCE(t.meta_template_status,'')) = 'APPROVED' THEN 'approved'
    WHEN UPPER(COALESCE(t.meta_template_status,'')) = 'PENDING'  THEN 'pending'
    WHEN UPPER(COALESCE(t.meta_template_status,'')) = 'REJECTED' THEN 'rejected'
    ELSE 'pending'
  END AS approval_status,
  wt.id   AS whatsapp_template_id,
  wt.status AS whatsapp_meta_status,
  wt.rejected_reason AS whatsapp_rejected_reason,
  wt.language AS whatsapp_language,
  wt.category AS whatsapp_category
FROM public.templates t
LEFT JOIN public.whatsapp_templates wt
  ON wt.branch_id = t.branch_id
 AND lower(wt.name) = lower(coalesce(t.meta_template_name, ''));

GRANT SELECT ON public.v_template_with_meta_status TO authenticated;
