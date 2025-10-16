-- Fix critical security issues

-- 1. FIX PROFILES TABLE - Remove public access to emails
-- Drop overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Users can view profiles of people in their leagues
CREATE POLICY "Users can view league member profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.league_members lm1
    JOIN public.league_members lm2 ON lm1.league_id = lm2.league_id
    WHERE lm1.user_id = auth.uid() 
    AND lm2.user_id = profiles.id
  )
);

-- 2. FIX LEAGUES TABLE - Restrict to authenticated users
-- Keep leagues viewable but only to authenticated users (for joining)
DROP POLICY IF EXISTS "Leagues are viewable by everyone" ON public.leagues;

CREATE POLICY "Authenticated users can view leagues"
ON public.leagues
FOR SELECT
TO authenticated
USING (true);

-- 3. FIX PLAYER RATINGS - Restrict to league members
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON public.player_ratings;

CREATE POLICY "League members can view ratings"
ON public.player_ratings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.league_members lm1
    JOIN public.league_members lm2 ON lm1.league_id = lm2.league_id
    WHERE lm1.user_id = auth.uid() 
    AND lm2.user_id = player_ratings.rated_player_id
  )
);

-- 4. FIX RATING AGGREGATES - Restrict to league members
DROP POLICY IF EXISTS "Rating aggregates are viewable by everyone" ON public.rating_aggregates;

CREATE POLICY "League members can view rating aggregates"
ON public.rating_aggregates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.league_members lm1
    JOIN public.league_members lm2 ON lm1.league_id = lm2.league_id
    WHERE lm1.user_id = auth.uid() 
    AND lm2.user_id = rating_aggregates.player_id
  )
);

-- 5. ADD RATING BOUNDS VALIDATION
ALTER TABLE public.player_ratings 
ADD CONSTRAINT rating_bounds CHECK (rating >= 1 AND rating <= 10);

-- 6. ADD TEAM ASSIGNMENT VALIDATION
CREATE OR REPLACE FUNCTION public.validate_team_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.team_number IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.matches 
      WHERE id = NEW.match_id 
      AND NEW.team_number <= number_of_teams
      AND NEW.team_number >= 1
    ) THEN
      RAISE EXCEPTION 'Številka ekipe mora biti med 1 in %', 
        (SELECT number_of_teams FROM public.matches WHERE id = NEW.match_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_team_number
BEFORE INSERT OR UPDATE ON public.match_participants
FOR EACH ROW 
EXECUTE FUNCTION public.validate_team_number();