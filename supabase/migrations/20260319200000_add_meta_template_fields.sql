-- Add Meta WhatsApp template approval tracking columns to the templates table
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS meta_template_name text,
  ADD COLUMN IF NOT EXISTS meta_template_status text CHECK (meta_template_status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED')),
  ADD COLUMN IF NOT EXISTS meta_rejection_reason text;

-- Index for fast lookup by meta template name (used in sync)
CREATE INDEX IF NOT EXISTS idx_templates_meta_template_name
  ON templates (meta_template_name)
  WHERE meta_template_name IS NOT NULL;
