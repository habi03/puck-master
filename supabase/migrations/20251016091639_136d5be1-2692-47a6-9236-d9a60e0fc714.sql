-- Allow league admins to update team assignments for match participants

CREATE POLICY "League admins can update team assignments"
ON public.match_participants
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM public.matches m
    WHERE m.id = match_participants.match_id
    AND is_league_admin(auth.uid(), m.league_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.matches m
    WHERE m.id = match_participants.match_id
    AND is_league_admin(auth.uid(), m.league_id)
  )
);