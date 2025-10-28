-- Create trigger function that updates beers_brought when match is completed
CREATE OR REPLACE FUNCTION public.update_beers_on_match_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  participant_record RECORD;
  v_count INTEGER;
BEGIN
  -- Only run if match was just completed
  IF NEW.is_completed = true AND (OLD.is_completed = false OR OLD.is_completed IS NULL) THEN
    -- Update beers_brought for all participants of this match
    FOR participant_record IN 
      SELECT DISTINCT player_id 
      FROM public.match_participants 
      WHERE match_id = NEW.id
    LOOP
      -- Count total beers brought by this player across all completed matches
      SELECT COUNT(*)
      INTO v_count
      FROM public.match_participants mp
      JOIN public.matches m ON mp.match_id = m.id
      WHERE mp.player_id = participant_record.player_id
      AND mp.brings_beer = true
      AND m.is_completed = true;
      
      -- Update the aggregate
      UPDATE public.rating_aggregates
      SET beers_brought = v_count,
          updated_at = NOW()
      WHERE player_id = participant_record.player_id;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on matches table
DROP TRIGGER IF EXISTS update_beers_on_match_completion_trigger ON public.matches;
CREATE TRIGGER update_beers_on_match_completion_trigger
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_beers_on_match_completion();