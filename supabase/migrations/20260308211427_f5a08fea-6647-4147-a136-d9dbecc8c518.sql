-- Add invoice_type column to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT NULL;

-- Add FK from branch_managers.user_id to profiles.id
ALTER TABLE public.branch_managers
  ADD CONSTRAINT branch_managers_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add FK from benefit_usage.recorded_by to profiles.id
ALTER TABLE public.benefit_usage
  ADD CONSTRAINT benefit_usage_recorded_by_profiles_fkey
  FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;