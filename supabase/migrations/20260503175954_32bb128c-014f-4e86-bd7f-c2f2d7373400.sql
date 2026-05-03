ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_kind text,
  ADD COLUMN IF NOT EXISTS attachment_filename text;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_attachment_kind_check;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_attachment_kind_check
  CHECK (attachment_kind IS NULL OR attachment_kind = ANY (ARRAY['image'::text, 'document'::text, 'video'::text]));

ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS is_stale boolean NOT NULL DEFAULT false;
