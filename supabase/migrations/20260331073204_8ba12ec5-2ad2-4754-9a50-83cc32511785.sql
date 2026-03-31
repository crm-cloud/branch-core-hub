-- Fix 1: Secure search_members with role-based authorization
CREATE OR REPLACE FUNCTION public.search_members(search_term text, p_branch_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, member_code text, full_name text, phone text, email text, avatar_url text, branch_id uuid, member_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only staff/admin/owner/manager can search members
  IF NOT public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized: Staff access required';
  END IF;

  -- Non-owner/admin staff can only search their own branch
  IF p_branch_id IS NULL AND NOT public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]) THEN
    SELECT sb.branch_id INTO p_branch_id FROM public.staff_branches sb WHERE sb.user_id = auth.uid() LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT 
    m.id,
    m.member_code,
    COALESCE(p.full_name, 'Unknown') as full_name,
    p.phone,
    p.email,
    p.avatar_url,
    m.branch_id,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM memberships ms 
        WHERE ms.member_id = m.id 
          AND ms.status = 'active'
          AND CURRENT_DATE BETWEEN ms.start_date AND ms.end_date
      ) THEN 'active'
      ELSE 'inactive'
    END as member_status
  FROM members m
  LEFT JOIN profiles p ON m.user_id = p.id
  WHERE 
    (p_branch_id IS NULL OR m.branch_id = p_branch_id)
    AND (
      m.member_code ILIKE '%' || search_term || '%'
      OR p.full_name ILIKE '%' || search_term || '%'
      OR p.phone ILIKE '%' || search_term || '%'
      OR p.email ILIKE '%' || search_term || '%'
    )
  ORDER BY p.full_name
  LIMIT p_limit;
END;
$function$;

-- Fix 2: Make documents bucket private and add scoped policies
UPDATE storage.buckets SET public = false WHERE id = 'documents';

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;

-- Staff+ can upload documents (scoped to their user folder or general)
CREATE POLICY "Staff upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
  )
);

-- Users read own documents; staff+ read all
CREATE POLICY "Users read own or staff read all documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
  )
);

-- Staff+ can delete documents
CREATE POLICY "Staff delete documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
  )
);