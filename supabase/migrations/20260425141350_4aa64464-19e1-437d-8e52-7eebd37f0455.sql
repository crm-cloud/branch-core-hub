-- ============================================================
-- Multi-provider AI gateway
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('lovable','openrouter','ollama','deepseek','openai_compatible')),
  display_name text NOT NULL,
  base_url text,
  api_key_secret_name text, -- e.g. 'OPENROUTER_API_KEY' or 'OLLAMA_API_KEY'; NULL for self-hosted no-auth
  default_model text NOT NULL,
  scope text NOT NULL DEFAULT 'all'
    CHECK (scope IN ('all','whatsapp_ai','lead_scoring','fitness_plans','dashboard_insights','lead_nurture')),
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  enable_fallback boolean NOT NULL DEFAULT true,
  extra_config jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_scope_active ON public.ai_provider_configs (scope, is_active, is_default);

CREATE TRIGGER trg_ai_provider_configs_updated_at
  BEFORE UPDATE ON public.ai_provider_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.ai_provider_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_ai_provider_configs" ON public.ai_provider_configs
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

-- Lightweight call log
CREATE TABLE IF NOT EXISTS public.ai_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  scope text,
  model text,
  status text NOT NULL CHECK (status IN ('success','error','fallback')),
  duration_ms integer,
  error_message text,
  fallback_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_call_logs_created ON public.ai_call_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_call_logs_provider ON public.ai_call_logs (provider, created_at DESC);

ALTER TABLE public.ai_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_view_ai_call_logs" ON public.ai_call_logs
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));

-- Seed Lovable AI as the default provider for "all" scope
INSERT INTO public.ai_provider_configs (provider, display_name, base_url, api_key_secret_name, default_model, scope, is_active, is_default, enable_fallback)
VALUES (
  'lovable',
  'Lovable AI (default)',
  'https://ai.gateway.lovable.dev/v1/chat/completions',
  'LOVABLE_API_KEY',
  'google/gemini-3-flash-preview',
  'all',
  true,
  true,
  false
)
ON CONFLICT DO NOTHING;