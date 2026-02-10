-- Clean up any members with empty member_code that have no memberships
DELETE FROM public.members 
WHERE (member_code = '' OR member_code IS NULL) 
  AND NOT EXISTS (SELECT 1 FROM public.memberships WHERE member_id = members.id);