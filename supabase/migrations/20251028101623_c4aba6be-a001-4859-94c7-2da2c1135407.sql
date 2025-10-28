-- Add foreign key relationship between league_members and profiles
ALTER TABLE public.league_members
ADD CONSTRAINT league_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;