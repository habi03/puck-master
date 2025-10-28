-- Add brings_beer column to match_participants
ALTER TABLE public.match_participants
ADD COLUMN brings_beer BOOLEAN NOT NULL DEFAULT false;

-- Add beers_brought counter to rating_aggregates for leaderboard
ALTER TABLE public.rating_aggregates
ADD COLUMN beers_brought INTEGER NOT NULL DEFAULT 0;

-- Create function to update beers_brought count
CREATE OR REPLACE FUNCTION public.update_beers_brought()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
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
$$;

-- Create trigger to update beers_brought count when match_participants is updated
CREATE TRIGGER update_beers_brought_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.match_participants
FOR EACH ROW
EXECUTE FUNCTION public.update_beers_brought();