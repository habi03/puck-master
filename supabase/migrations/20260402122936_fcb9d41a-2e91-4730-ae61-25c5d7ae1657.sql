
CREATE OR REPLACE FUNCTION public.is_league_admin(_user_id uuid, _league_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.league_members
    WHERE user_id = _user_id
      AND league_id = _league_id
      AND role IN ('admin', 'super_user')
  )
$$;
