-- Add is_completed column to matches table to track if match results have been finalized
ALTER TABLE public.matches
ADD COLUMN is_completed BOOLEAN NOT NULL DEFAULT false;

-- Add index for faster queries
CREATE INDEX idx_matches_is_completed ON public.matches(is_completed);