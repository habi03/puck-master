-- Create saves table to track goalkeeper saves
CREATE TABLE public.saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_number INTEGER NOT NULL,
  saves_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;

-- RLS policies for saves table
CREATE POLICY "League members can view saves"
ON public.saves
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = saves.match_id
    AND is_league_member(auth.uid(), m.league_id)
  )
);

CREATE POLICY "League admins can insert saves"
ON public.saves
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = saves.match_id
    AND is_league_admin(auth.uid(), m.league_id)
  )
);

CREATE POLICY "League admins can update saves"
ON public.saves
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = saves.match_id
    AND is_league_admin(auth.uid(), m.league_id)
  )
);

CREATE POLICY "League admins can delete saves"
ON public.saves
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = saves.match_id
    AND is_league_admin(auth.uid(), m.league_id)
  )
);

-- Add index for faster queries
CREATE INDEX idx_saves_match_id ON public.saves(match_id);
CREATE INDEX idx_saves_player_id ON public.saves(player_id);