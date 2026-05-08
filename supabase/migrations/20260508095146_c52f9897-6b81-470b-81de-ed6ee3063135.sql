UPDATE public.error_logs
SET status='resolved', resolved_at=now()
WHERE status='open'
  AND source='automation_brain'
  AND error_message ILIKE '%HTTP 401%';

UPDATE public.error_logs
SET status='resolved', resolved_at=now()
WHERE status='open'
  AND source='frontend'
  AND error_message ILIKE 'Network error%'
  AND created_at < now() - interval '1 hour';

UPDATE public.error_logs
SET status='resolved', resolved_at=now()
WHERE status='open'
  AND source='frontend'
  AND error_message ILIKE '%WebGL context%';