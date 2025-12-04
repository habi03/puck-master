-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can sign up for matches in their leagues" ON public.match_participants;

-- Create updated INSERT policy that allows both self-signup and admin additions
CREATE POLICY "Users can sign up for matches in their leagues" 
ON public.match_participants 
FOR INSERT 
WITH CHECK (
  -- User signing themselves up
  (auth.uid() = player_id AND EXISTS (
    SELECT 1 FROM matches m
    JOIN league_members lm ON m.league_id = lm.league_id
    WHERE m.id = match_participants.match_id AND lm.user_id = auth.uid()
  ))
  OR
  -- League admin adding any league member
  (EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = match_participants.match_id 
    AND is_league_admin(auth.uid(), m.league_id)
  ) AND EXISTS (
    SELECT 1 FROM matches m
    JOIN league_members lm ON m.league_id = lm.league_id
    WHERE m.id = match_participants.match_id AND lm.user_id = match_participants.player_id
  ))
);