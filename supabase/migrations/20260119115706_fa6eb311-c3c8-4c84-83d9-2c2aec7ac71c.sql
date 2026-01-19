-- Fix 1: Update trainers table RLS policies to protect sensitive data
-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Trainers are viewable by everyone" ON public.trainers;
DROP POLICY IF EXISTS "View trainers" ON public.trainers;
DROP POLICY IF EXISTS "trainers_select_policy" ON public.trainers;
DROP POLICY IF EXISTS "Admins view all trainers" ON public.trainers;
DROP POLICY IF EXISTS "Trainers view own record" ON public.trainers;
DROP POLICY IF EXISTS "Staff view active trainers" ON public.trainers;
DROP POLICY IF EXISTS "Members view active trainers" ON public.trainers;

-- Create policy for owners/admins/managers - full access to all trainer data
CREATE POLICY "Admins view all trainers"
ON public.trainers FOR SELECT
USING (
  public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[])
);

-- Create policy for trainers to view their own record with all fields
CREATE POLICY "Trainers view own record"
ON public.trainers FOR SELECT
USING (user_id = auth.uid());

-- Create policy for staff members to view active trainers (limited fields via application code)
CREATE POLICY "Staff view active trainers"
ON public.trainers FOR SELECT
USING (
  public.has_role(auth.uid(), 'staff') AND is_active = true
);

-- Create policy for members to view active trainers (application code should limit fields)
CREATE POLICY "Members view active trainers"
ON public.trainers FOR SELECT
USING (
  public.has_role(auth.uid(), 'member') AND is_active = true
);

-- Fix 2: Make member-photos storage bucket private
UPDATE storage.buckets SET public = false WHERE id = 'member-photos';

-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can view member photos" ON storage.objects;

-- Create proper policy for member photos - members view own, staff can view all
DROP POLICY IF EXISTS "Members can view own photos" ON storage.objects;
CREATE POLICY "Members can view own photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'member-photos' AND
  (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[])
  )
);

-- Fix 3: Create a secure view for public trainer info (no sensitive columns)
DROP VIEW IF EXISTS public.trainers_public;
CREATE VIEW public.trainers_public AS
SELECT 
  t.id,
  t.branch_id,
  t.bio,
  t.specializations,
  t.certifications,
  t.max_clients,
  t.is_active,
  t.created_at,
  p.full_name,
  p.avatar_url
FROM public.trainers t
LEFT JOIN public.profiles p ON t.user_id = p.id
WHERE t.is_active = true;

-- Grant access to authenticated users for the view
GRANT SELECT ON public.trainers_public TO authenticated;
GRANT SELECT ON public.trainers_public TO anon;

-- Fix 4: Update SECURITY DEFINER functions that lack search_path
-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update generate_member_code function
CREATE OR REPLACE FUNCTION public.generate_member_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  branch_code TEXT;
  seq_num INTEGER;
BEGIN
  SELECT code INTO branch_code FROM public.branches WHERE id = NEW.branch_id;
  SELECT COUNT(*) + 1 INTO seq_num FROM public.members WHERE branch_id = NEW.branch_id;
  NEW.member_code := branch_code || '-' || LPAD(seq_num::TEXT, 5, '0');
  RETURN NEW;
END;
$function$;

-- Update generate_invoice_number function
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  branch_code TEXT;
  year_month TEXT;
  seq_num INTEGER;
BEGIN
  SELECT code INTO branch_code FROM public.branches WHERE id = NEW.branch_id;
  year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
  SELECT COUNT(*) + 1 INTO seq_num 
  FROM public.invoices 
  WHERE branch_id = NEW.branch_id 
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);
  NEW.invoice_number := 'INV-' || branch_code || '-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;