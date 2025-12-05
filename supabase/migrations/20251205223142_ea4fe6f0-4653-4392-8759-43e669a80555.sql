-- Add separate limits for players and goalkeepers
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS max_players integer DEFAULT NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS max_goalkeepers integer DEFAULT NULL;

-- Migrate existing max_participants to max_players (assuming it was for players)
UPDATE public.matches 
SET max_players = max_participants 
WHERE max_participants IS NOT NULL;