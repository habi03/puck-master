-- Fix the security definer view issue
-- Recreate the view with explicit SECURITY INVOKER to prevent privilege escalation
DROP VIEW IF EXISTS public.public_leagues;

CREATE VIEW public.public_leagues 
WITH (security_invoker = true)
AS
SELECT 
  id, 
  name, 
  description, 
  created_by, 
  created_at, 
  updated_at,
  CASE WHEN password IS NOT NULL AND password != '' THEN true ELSE false END as has_password
FROM public.leagues;

-- Grant access to authenticated users
GRANT SELECT ON public.public_leagues TO authenticated;