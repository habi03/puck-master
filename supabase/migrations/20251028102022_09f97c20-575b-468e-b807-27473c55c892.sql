-- Add password field to leagues table for optional password protection
ALTER TABLE public.leagues
ADD COLUMN password TEXT;