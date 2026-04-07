DROP VIEW IF EXISTS public.public_leagues;
CREATE VIEW public.public_leagues AS
SELECT 
  id,
  name,
  description,
  created_by,
  created_at,
  updated_at,
  (password IS NOT NULL AND password != '') AS has_password,
  sport_type
FROM public.leagues;