
-- Create ai_tool_logs table
CREATE TABLE public.ai_tool_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT,
  phone_number TEXT,
  branch_id UUID REFERENCES public.branches(id),
  message_id UUID,
  tool_name TEXT NOT NULL,
  arguments JSONB DEFAULT '{}',
  result JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_tool_logs_created ON public.ai_tool_logs(created_at DESC);
CREATE INDEX idx_ai_tool_logs_phone ON public.ai_tool_logs(phone_number);
CREATE INDEX idx_ai_tool_logs_status ON public.ai_tool_logs(status);

ALTER TABLE public.ai_tool_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view AI tool logs"
  ON public.ai_tool_logs
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

CREATE POLICY "Service role can insert AI tool logs"
  ON public.ai_tool_logs
  FOR INSERT
  WITH CHECK (true);

-- Add ai_tool_config to organization_settings
ALTER TABLE public.organization_settings ADD COLUMN IF NOT EXISTS ai_tool_config JSONB DEFAULT '{}';
