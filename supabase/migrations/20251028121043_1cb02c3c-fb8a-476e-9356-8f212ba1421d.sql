-- Add league membership validation to update_rating_aggregate function
CREATE OR REPLACE FUNCTION public.update_rating_aggregate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_avg DECIMAL(3,2);
  v_count INTEGER;
  v_sum INTEGER;
  v_shared_league BOOLEAN;
BEGIN
  -- Verify rater and rated player share a league
  SELECT EXISTS (
    SELECT 1 FROM league_members lm1
    JOIN league_members lm2 ON lm1.league_id = lm2.league_id
    WHERE lm1.user_id = NEW.rater_id 
    AND lm2.user_id = NEW.rated_player_id
  ) INTO v_shared_league;
  
  IF NOT v_shared_league THEN
    RAISE EXCEPTION 'Users must share a league to rate each other';
  END IF;
  
  -- Calculate new aggregates
  SELECT 
    COALESCE(AVG(rating), 0),
    COUNT(*),
    COALESCE(SUM(rating), 0)
  INTO v_avg, v_count, v_sum
  FROM public.player_ratings
  WHERE rated_player_id = COALESCE(NEW.rated_player_id, OLD.rated_player_id);
  
  -- Update or insert aggregate
  INSERT INTO public.rating_aggregates (player_id, average_rating, total_ratings, sum_ratings, updated_at)
  VALUES (
    COALESCE(NEW.rated_player_id, OLD.rated_player_id),
    v_avg,
    v_count,
    v_sum,
    NOW()
  )
  ON CONFLICT (player_id)
  DO UPDATE SET
    average_rating = v_avg,
    total_ratings = v_count,
    sum_ratings = v_sum,
    updated_at = NOW();
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Add league membership validation to update_beers_brought function
CREATE OR REPLACE FUNCTION public.update_beers_brought()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
  v_league_id UUID;
  v_is_member BOOLEAN;
BEGIN
  -- Get the league_id for this match
  SELECT league_id INTO v_league_id
  FROM public.matches 
  WHERE id = COALESCE(NEW.match_id, OLD.match_id);
  
  -- Verify the player is a member of the league
  SELECT EXISTS (
    SELECT 1 FROM public.league_members
    WHERE user_id = COALESCE(NEW.player_id, OLD.player_id)
    AND league_id = v_league_id
  ) INTO v_is_member;
  
  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Player must be a member of the league';
  END IF;
  
  -- Count how many times this player brought beer (only for completed matches)
  SELECT COUNT(*)
  INTO v_count
  FROM public.match_participants mp
  JOIN public.matches m ON mp.match_id = m.id
  WHERE mp.player_id = COALESCE(NEW.player_id, OLD.player_id)
  AND mp.brings_beer = true
  AND m.is_completed = true;
  
  -- Update the aggregate
  UPDATE public.rating_aggregates
  SET beers_brought = v_count,
      updated_at = NOW()
  WHERE player_id = COALESCE(NEW.player_id, OLD.player_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;