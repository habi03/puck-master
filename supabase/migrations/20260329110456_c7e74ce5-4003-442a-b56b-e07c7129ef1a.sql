
-- Create seasons table
CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add season_id to matches (nullable for backwards compatibility)
ALTER TABLE public.matches ADD COLUMN season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- RLS policies for seasons
CREATE POLICY "League members can view seasons"
  ON public.seasons FOR SELECT
  TO authenticated
  USING (is_league_member(auth.uid(), league_id));

CREATE POLICY "League admins can insert seasons"
  ON public.seasons FOR INSERT
  TO authenticated
  WITH CHECK (is_league_admin(auth.uid(), league_id));

CREATE POLICY "League admins can update seasons"
  ON public.seasons FOR UPDATE
  TO authenticated
  USING (is_league_admin(auth.uid(), league_id));

CREATE POLICY "League admins can delete seasons"
  ON public.seasons FOR DELETE
  TO authenticated
  USING (is_league_admin(auth.uid(), league_id));

-- Trigger for updated_at
CREATE TRIGGER update_seasons_updated_at
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
