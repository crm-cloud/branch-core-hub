DELETE FROM public.leads WHERE id = 'bb5c0647-f078-4477-a7fb-773bd703b1cc';

CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_active_uidx
  ON public.leads (branch_id, phone)
  WHERE status NOT IN ('converted','lost');