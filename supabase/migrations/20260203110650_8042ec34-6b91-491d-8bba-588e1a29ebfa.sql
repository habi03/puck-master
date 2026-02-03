-- Add is_absent column to track players who marked themselves as absent
ALTER TABLE public.match_participants 
ADD COLUMN is_absent boolean NOT NULL DEFAULT false;

-- Add a comment explaining the column
COMMENT ON COLUMN public.match_participants.is_absent IS 'True if player has marked themselves as absent from this match';