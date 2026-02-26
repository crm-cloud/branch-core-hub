
-- Fix staff_branches: drop unique constraint on user_id to allow multi-branch managers
-- and add composite unique on (user_id, branch_id) instead

-- First drop the existing unique index on user_id (the isOneToOne constraint)
DO $$
BEGIN
  -- Drop any unique constraint/index on just user_id
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'staff_branches' 
    AND indexdef LIKE '%user_id%' 
    AND indexdef NOT LIKE '%branch_id%'
    AND indexdef LIKE '%UNIQUE%'
  ) THEN
    -- Find and drop the constraint
    EXECUTE (
      SELECT 'ALTER TABLE public.staff_branches DROP CONSTRAINT ' || conname
      FROM pg_constraint 
      WHERE conrelid = 'public.staff_branches'::regclass 
      AND contype = 'u'
      AND array_length(conkey, 1) = 1
      AND conkey[1] = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.staff_branches'::regclass AND attname = 'user_id')
      LIMIT 1
    );
  END IF;
END $$;

-- Add composite unique constraint (user_id, branch_id) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.staff_branches'::regclass 
    AND contype = 'u'
    AND array_length(conkey, 1) = 2
  ) THEN
    ALTER TABLE public.staff_branches ADD CONSTRAINT staff_branches_user_branch_unique UNIQUE (user_id, branch_id);
  END IF;
END $$;
