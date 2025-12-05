-- Add scoring configuration columns to leagues table
ALTER TABLE public.leagues
ADD COLUMN points_attendance INTEGER NOT NULL DEFAULT 1,
ADD COLUMN points_win INTEGER NOT NULL DEFAULT 3,
ADD COLUMN points_penalty_win INTEGER NOT NULL DEFAULT 2,
ADD COLUMN points_penalty_loss INTEGER NOT NULL DEFAULT 1;