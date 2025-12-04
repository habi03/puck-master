-- Add column to store which team assignment algorithm was used
ALTER TABLE public.matches 
ADD COLUMN team_algorithm text DEFAULT NULL;