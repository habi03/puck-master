-- Add combined_rating column to match_participants
ALTER TABLE public.match_participants 
ADD COLUMN combined_rating DECIMAL(5,2);

COMMENT ON COLUMN public.match_participants.combined_rating IS 'Combined rating at time of signup: 0.6 * peer rating + 0.4 * leaderboard position';