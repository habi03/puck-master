-- Create tables for match results and goals

-- Table for match results per team
CREATE TABLE public.match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_number INTEGER NOT NULL,
  goals_scored INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, team_number)
);

-- Table for individual goals
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  team_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for match_results
CREATE POLICY "League members can view match results"
ON public.match_results
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_results.match_id
    AND is_league_member(auth.uid(), m.league_id)
  )
);

CREATE POLICY "League admins can insert match results"
ON public.match_results
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_results.match_id
    AND is_league_admin(auth.uid(), m.league_id)
  )
);

CREATE POLICY "League admins can update match results"
ON public.match_results
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_results.match_id
    AND is_league_admin(auth.uid(), m.league_id)
  )
);

CREATE POLICY "League admins can delete match results"
ON public.match_results
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_results.match_id
    AND is_league_admin(auth.uid(), m.league_id)
  )
);

-- RLS Policies for goals
CREATE POLICY "League members can view goals"
ON public.goals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = goals.match_id
    AND is_league_member(auth.uid(), m.league_id)
  )
);

CREATE POLICY "League admins can insert goals"
ON public.goals
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = goals.match_id
    AND is_league_admin(auth.uid(), m.league_id)
  )
);

CREATE POLICY "League admins can delete goals"
ON public.goals
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = goals.match_id
    AND is_league_admin(auth.uid(), m.league_id)
  )
);

-- Add updated_at trigger for match_results
CREATE TRIGGER update_match_results_updated_at
BEFORE UPDATE ON public.match_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();