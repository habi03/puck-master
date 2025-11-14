-- Update the trigger function to handle larger rating values
CREATE OR REPLACE FUNCTION public.update_rating_aggregate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_avg DECIMAL(5,2);  -- Changed from DECIMAL(3,2) to support ratings up to 100
  v_count INTEGER;
  v_sum INTEGER;
  v_shared_league BOOLEAN;
  v_profile_exists BOOLEAN;
BEGIN
  -- Only verify shared league for INSERT and UPDATE operations
  IF TG_OP != 'DELETE' THEN
    SELECT EXISTS (
      SELECT 1 FROM league_members lm1
      JOIN league_members lm2 ON lm1.league_id = lm2.league_id
      WHERE lm1.user_id = NEW.rater_id 
      AND lm2.user_id = NEW.rated_player_id
    ) INTO v_shared_league;
    
    IF NOT v_shared_league THEN
      RAISE EXCEPTION 'Users must share a league to rate each other';
    END IF;
  END IF;
  
  -- Check if the profile still exists before updating aggregates
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = COALESCE(NEW.rated_player_id, OLD.rated_player_id)
  ) INTO v_profile_exists;
  
  IF NOT v_profile_exists THEN
    RETURN COALESCE(NEW, OLD);
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

-- Change average_rating column to support larger values
ALTER TABLE public.rating_aggregates 
ALTER COLUMN average_rating TYPE NUMERIC(5,2);

-- Remove all rating constraints from player_ratings
ALTER TABLE public.player_ratings 
DROP CONSTRAINT IF EXISTS player_ratings_rating_check;

ALTER TABLE public.player_ratings 
DROP CONSTRAINT IF EXISTS rating_bounds;

-- Scale all existing ratings by 10
UPDATE public.player_ratings SET rating = rating * 10;

-- Add new rating constraint (1-100)
ALTER TABLE public.player_ratings
ADD CONSTRAINT player_ratings_rating_check CHECK (rating >= 1 AND rating <= 100);

COMMENT ON COLUMN public.player_ratings.rating IS 'Player rating from 1 to 100';
COMMENT ON COLUMN public.rating_aggregates.average_rating IS 'Average player rating from 1 to 100';