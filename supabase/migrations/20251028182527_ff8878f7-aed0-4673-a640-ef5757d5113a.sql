-- Add foreign key relationship between league_members and profiles
-- This is needed for the nested select to work in Admin panel

ALTER TABLE league_members
DROP CONSTRAINT IF EXISTS league_members_user_id_fkey;

ALTER TABLE league_members
ADD CONSTRAINT league_members_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;