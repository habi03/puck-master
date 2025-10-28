-- Fix Issue #1 & #2: Hide league passwords from public queries
-- Create a view that excludes passwords but shows if a league has one
CREATE OR REPLACE VIEW public.public_leagues AS
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

-- Fix Issue #3: Validate league membership when signing up for matches
-- Drop the old policy
DROP POLICY IF EXISTS "Users can sign up for matches" ON public.match_participants;

-- Create new policy that verifies league membership
CREATE POLICY "Users can sign up for matches in their leagues"
ON public.match_participants FOR INSERT
WITH CHECK (
  auth.uid() = player_id AND
  EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.league_members lm ON m.league_id = lm.league_id
    WHERE m.id = match_participants.match_id
      AND lm.user_id = auth.uid()
  )
);