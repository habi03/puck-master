-- Allow super_users to update any rating in their league
CREATE POLICY "Super users can update any ratings"
ON public.player_ratings
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM league_members lm1
    JOIN league_members lm2 ON lm1.league_id = lm2.league_id
    WHERE lm1.user_id = auth.uid()
      AND lm1.role = 'super_user'
      AND lm2.user_id = player_ratings.rated_player_id
  )
);

-- Allow super_users to delete any rating in their league
CREATE POLICY "Super users can delete any ratings"
ON public.player_ratings
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM league_members lm1
    JOIN league_members lm2 ON lm1.league_id = lm2.league_id
    WHERE lm1.user_id = auth.uid()
      AND lm1.role = 'super_user'
      AND lm2.user_id = player_ratings.rated_player_id
  )
);