
-- Add comp_gift to approval_type enum
ALTER TYPE public.approval_type ADD VALUE IF NOT EXISTS 'comp_gift';
