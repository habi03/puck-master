-- Add scoring columns to matches table (nullable - when null, use league defaults)
ALTER TABLE public.matches
ADD COLUMN points_attendance integer DEFAULT NULL,
ADD COLUMN points_win integer DEFAULT NULL,
ADD COLUMN points_penalty_win integer DEFAULT NULL,
ADD COLUMN points_penalty_loss integer DEFAULT NULL;