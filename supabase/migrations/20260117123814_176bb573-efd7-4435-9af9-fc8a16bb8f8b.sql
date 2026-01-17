
-- Create the updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create benefit_types table for dynamic/customizable benefit definitions
CREATE TABLE public.benefit_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Sparkles',
  is_bookable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  category TEXT DEFAULT 'wellness',
  default_duration_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(branch_id, code)
);

-- Enable RLS
ALTER TABLE public.benefit_types ENABLE ROW LEVEL SECURITY;

-- RLS policies for benefit_types
CREATE POLICY "Users can view benefit types for their branch"
ON public.benefit_types FOR SELECT
USING (true);

CREATE POLICY "Staff can manage benefit types"
ON public.benefit_types FOR ALL
USING (true);

-- Add benefit_type_id to benefit_settings (nullable for migration)
ALTER TABLE public.benefit_settings 
ADD COLUMN IF NOT EXISTS benefit_type_id UUID REFERENCES public.benefit_types(id) ON DELETE CASCADE;

-- Add benefit_type_id to benefit_slots
ALTER TABLE public.benefit_slots 
ADD COLUMN IF NOT EXISTS benefit_type_id UUID REFERENCES public.benefit_types(id) ON DELETE CASCADE;

-- Add benefit_type_id to benefit_packages
ALTER TABLE public.benefit_packages 
ADD COLUMN IF NOT EXISTS benefit_type_id UUID REFERENCES public.benefit_types(id) ON DELETE CASCADE;

-- Add benefit_type_id to member_benefit_credits
ALTER TABLE public.member_benefit_credits 
ADD COLUMN IF NOT EXISTS benefit_type_id UUID REFERENCES public.benefit_types(id) ON DELETE CASCADE;

-- Add benefit_type_id to benefit_usage
ALTER TABLE public.benefit_usage 
ADD COLUMN IF NOT EXISTS benefit_type_id UUID REFERENCES public.benefit_types(id) ON DELETE CASCADE;

-- Create trigger for benefit_types updated_at
CREATE TRIGGER update_benefit_types_updated_at
BEFORE UPDATE ON public.benefit_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for faster lookups
CREATE INDEX idx_benefit_types_branch ON public.benefit_types(branch_id);
CREATE INDEX idx_benefit_types_bookable ON public.benefit_types(is_bookable) WHERE is_active = true;
