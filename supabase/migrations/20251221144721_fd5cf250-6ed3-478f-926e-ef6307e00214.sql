-- Add government ID fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS government_id_type text,
ADD COLUMN IF NOT EXISTS government_id_number text,
ADD COLUMN IF NOT EXISTS government_id_verified boolean DEFAULT false;

-- Create member_measurements table for tracking progress
CREATE TABLE public.member_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  recorded_by uuid REFERENCES public.profiles(id),
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  weight_kg numeric,
  height_cm numeric,
  body_fat_percentage numeric,
  chest_cm numeric,
  waist_cm numeric,
  hips_cm numeric,
  biceps_left_cm numeric,
  biceps_right_cm numeric,
  thighs_left_cm numeric,
  thighs_right_cm numeric,
  calves_cm numeric,
  notes text,
  photos jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_member_measurements_member_id ON public.member_measurements(member_id);
CREATE INDEX idx_member_measurements_recorded_at ON public.member_measurements(recorded_at DESC);

-- Enable RLS
ALTER TABLE public.member_measurements ENABLE ROW LEVEL SECURITY;

-- RLS policies for member_measurements
CREATE POLICY "Staff can view all measurements"
  ON public.member_measurements FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "Members can view their own measurements"
  ON public.member_measurements FOR SELECT
  USING (member_id = public.get_member_id(auth.uid()));

CREATE POLICY "Staff can insert measurements"
  ON public.member_measurements FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));

CREATE POLICY "Members can insert their own measurements"
  ON public.member_measurements FOR INSERT
  WITH CHECK (member_id = public.get_member_id(auth.uid()));

CREATE POLICY "Staff can update measurements"
  ON public.member_measurements FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));

CREATE POLICY "Staff can delete measurements"
  ON public.member_measurements FOR DELETE
  USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

-- Create member-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-photos', 'member-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for member-photos bucket
CREATE POLICY "Anyone can view member photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'member-photos');

CREATE POLICY "Staff can upload member photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'member-photos' AND
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[])
  );

CREATE POLICY "Members can upload their own photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'member-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Staff can delete member photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'member-photos' AND
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
  );

-- Add refund fields to invoices if not exists
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS refund_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS refund_reason text,
ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS refunded_by uuid REFERENCES public.profiles(id);

-- Add cancellation fields to memberships if not exists
ALTER TABLE public.memberships
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS refund_amount numeric DEFAULT 0;