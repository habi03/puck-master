-- Add win_type column to match_results table
ALTER TABLE public.match_results 
ADD COLUMN win_type text;

-- Add check constraint to ensure valid win types
ALTER TABLE public.match_results
ADD CONSTRAINT valid_win_type CHECK (win_type IN ('regulation', 'penalty_shootout'));

COMMENT ON COLUMN public.match_results.win_type IS 'Type of win: regulation (3 points) or penalty_shootout (2 points for winner, 1 for loser)';