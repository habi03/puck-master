-- Drop existing foreign key constraints that need CASCADE behavior
-- We'll recreate them with ON DELETE CASCADE

-- For match_participants table
ALTER TABLE match_participants
DROP CONSTRAINT IF EXISTS match_participants_player_id_fkey;

ALTER TABLE match_participants
ADD CONSTRAINT match_participants_player_id_fkey
FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- For goals table
ALTER TABLE goals
DROP CONSTRAINT IF EXISTS goals_player_id_fkey;

ALTER TABLE goals
ADD CONSTRAINT goals_player_id_fkey
FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- For saves table
ALTER TABLE saves
DROP CONSTRAINT IF EXISTS saves_player_id_fkey;

ALTER TABLE saves
ADD CONSTRAINT saves_player_id_fkey
FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- For player_ratings table (both rater and rated player)
ALTER TABLE player_ratings
DROP CONSTRAINT IF EXISTS player_ratings_rater_id_fkey;

ALTER TABLE player_ratings
ADD CONSTRAINT player_ratings_rater_id_fkey
FOREIGN KEY (rater_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE player_ratings
DROP CONSTRAINT IF EXISTS player_ratings_rated_player_id_fkey;

ALTER TABLE player_ratings
ADD CONSTRAINT player_ratings_rated_player_id_fkey
FOREIGN KEY (rated_player_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- For rating_aggregates table
ALTER TABLE rating_aggregates
DROP CONSTRAINT IF EXISTS rating_aggregates_player_id_fkey;

ALTER TABLE rating_aggregates
ADD CONSTRAINT rating_aggregates_player_id_fkey
FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- For league_members table (user_id)
ALTER TABLE league_members
DROP CONSTRAINT IF EXISTS league_members_user_id_fkey;

ALTER TABLE league_members
ADD CONSTRAINT league_members_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;