-- Expand allowed providers
ALTER TABLE public.ai_provider_configs
  DROP CONSTRAINT IF EXISTS ai_provider_configs_provider_check;

ALTER TABLE public.ai_provider_configs
  ADD CONSTRAINT ai_provider_configs_provider_check
  CHECK (provider = ANY (ARRAY[
    'lovable','openrouter','ollama','deepseek','openai_compatible',
    'google','groq','together','mistral'
  ]));

-- Seed Lovable AI as the always-available global default if not present
INSERT INTO public.ai_provider_configs
  (provider, display_name, base_url, api_key_secret_name, default_model, scope, is_active, is_default, enable_fallback)
SELECT 'lovable', 'Lovable AI', 'https://ai.gateway.lovable.dev/v1/chat/completions',
       'LOVABLE_API_KEY', 'google/gemini-2.5-flash', 'all', true, true, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_provider_configs WHERE provider = 'lovable' AND scope = 'all'
);