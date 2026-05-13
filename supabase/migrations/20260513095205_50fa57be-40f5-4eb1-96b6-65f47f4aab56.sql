UPDATE public.error_logs
SET status='resolved', resolved_at=now()
WHERE status='open'
  AND (
    error_message IN (
      'Error creating WebGL context.',
      'Cannot read properties of undefined (reading ''add'')',
      '404 — Route not found: /incline',
      'Setup check failed: Failed to send a request to the Edge Function',
      'Load failed'
    )
    OR error_message ILIKE 'Failed to fetch dynamically imported module%'
    OR error_message ILIKE 'Network error - check your internet connection%'
  );