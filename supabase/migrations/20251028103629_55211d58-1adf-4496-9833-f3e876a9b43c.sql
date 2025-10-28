-- When a user is removed from league_members, automatically remove them from all match participants in that league
CREATE OR REPLACE FUNCTION public.remove_user_from_league_matches()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all match participations for this user in matches of this league
  DELETE FROM public.match_participants
  WHERE player_id = OLD.user_id
  AND match_id IN (
    SELECT id FROM public.matches WHERE league_id = OLD.league_id
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Create trigger to run when a league member is removed
CREATE TRIGGER on_league_member_removed
  BEFORE DELETE ON public.league_members
  FOR EACH ROW
  EXECUTE FUNCTION public.remove_user_from_league_matches();