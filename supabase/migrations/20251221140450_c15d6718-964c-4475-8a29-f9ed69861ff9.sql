-- Add created_by audit field to members table
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_members_created_by ON public.members(created_by);

-- Comment for documentation
COMMENT ON COLUMN public.members.created_by IS 'User who created this member record';