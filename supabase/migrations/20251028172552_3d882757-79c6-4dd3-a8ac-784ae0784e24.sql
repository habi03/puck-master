-- Fix the update_beers_brought function to not check membership on DELETE operations
CREATE OR REPLACE FUNCTION public.update_beers_brought()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
  v_league_id UUID;
  v_is_member BOOLEAN;
  v_player_id UUID;
BEGIN
  -- Determine the player_id and match_id based on operation
  v_player_id := COALESCE(NEW.player_id, OLD.player_id);
  
  -- Get the league_id for this match
  SELECT league_id INTO v_league_id
  FROM public.matches 
  WHERE id = COALESCE(NEW.match_id, OLD.match_id);
  
  -- Only verify membership for INSERT/UPDATE operations, not DELETE
  IF TG_OP != 'DELETE' THEN
    -- Verify the player is a member of the league
    SELECT EXISTS (
      SELECT 1 FROM public.league_members
      WHERE user_id = v_player_id
      AND league_id = v_league_id
    ) INTO v_is_member;
    
    IF NOT v_is_member THEN
      RAISE EXCEPTION 'Player must be a member of the league';
    END IF;
  END IF;
  
  -- Count how many times this player brought beer (only for completed matches)
  SELECT COUNT(*)
  INTO v_count
  FROM public.match_participants mp
  JOIN public.matches m ON mp.match_id = m.id
  WHERE mp.player_id = v_player_id
  AND mp.brings_beer = true
  AND m.is_completed = true;
  
  -- Update the aggregate (will be 0 if player no longer exists)
  UPDATE public.rating_aggregates
  SET beers_brought = v_count,
      updated_at = NOW()
  WHERE player_id = v_player_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;