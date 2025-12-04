-- Add new columns to matches table for additional features
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS signups_locked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS max_participants integer,
ADD COLUMN IF NOT EXISTS notes text;