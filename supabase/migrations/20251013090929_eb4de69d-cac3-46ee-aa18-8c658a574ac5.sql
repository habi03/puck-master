-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('neplačan_član', 'administrator');

-- Create enum for player position on match
CREATE TYPE public.player_position AS ENUM ('igralec', 'vratar');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'neplačan_član',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create player ratings subcollection (stores who rated whom and when)
CREATE TABLE public.player_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rated_player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rated_player_id, rater_id)
);

-- Create rating aggregates table (stores calculated averages)
CREATE TABLE public.rating_aggregates (
  player_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  average_rating DECIMAL(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  sum_ratings INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_date DATE NOT NULL,
  match_time TIME NOT NULL,
  number_of_teams INTEGER NOT NULL CHECK (number_of_teams >= 2),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create match participants table
CREATE TABLE public.match_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position player_position NOT NULL,
  is_present BOOLEAN DEFAULT TRUE,
  team_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for player_ratings
CREATE POLICY "Ratings are viewable by everyone"
  ON public.player_ratings FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can create ratings"
  ON public.player_ratings FOR INSERT
  WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "Users can update their own ratings"
  ON public.player_ratings FOR UPDATE
  USING (auth.uid() = rater_id);

CREATE POLICY "Users can delete their own ratings"
  ON public.player_ratings FOR DELETE
  USING (auth.uid() = rater_id);

-- RLS Policies for rating_aggregates
CREATE POLICY "Rating aggregates are viewable by everyone"
  ON public.rating_aggregates FOR SELECT
  USING (TRUE);

-- RLS Policies for matches
CREATE POLICY "Matches are viewable by everyone"
  ON public.matches FOR SELECT
  USING (TRUE);

CREATE POLICY "Authenticated users can create matches"
  ON public.matches FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Match creators can update their matches"
  ON public.matches FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Match creators can delete their matches"
  ON public.matches FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for match_participants
CREATE POLICY "Match participants are viewable by everyone"
  ON public.match_participants FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can sign up for matches"
  ON public.match_participants FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update their own participation"
  ON public.match_participants FOR UPDATE
  USING (auth.uid() = player_id);

CREATE POLICY "Users can remove their participation"
  ON public.match_participants FOR DELETE
  USING (auth.uid() = player_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'neplačan_član'
  );
  
  -- Initialize rating aggregate
  INSERT INTO public.rating_aggregates (player_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update rating aggregates
CREATE OR REPLACE FUNCTION public.update_rating_aggregate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg DECIMAL(3,2);
  v_count INTEGER;
  v_sum INTEGER;
BEGIN
  -- Calculate new aggregates
  SELECT 
    COALESCE(AVG(rating), 0),
    COUNT(*),
    COALESCE(SUM(rating), 0)
  INTO v_avg, v_count, v_sum
  FROM public.player_ratings
  WHERE rated_player_id = COALESCE(NEW.rated_player_id, OLD.rated_player_id);
  
  -- Update or insert aggregate
  INSERT INTO public.rating_aggregates (player_id, average_rating, total_ratings, sum_ratings, updated_at)
  VALUES (
    COALESCE(NEW.rated_player_id, OLD.rated_player_id),
    v_avg,
    v_count,
    v_sum,
    NOW()
  )
  ON CONFLICT (player_id)
  DO UPDATE SET
    average_rating = v_avg,
    total_ratings = v_count,
    sum_ratings = v_sum,
    updated_at = NOW();
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers for rating aggregate updates
CREATE TRIGGER update_rating_aggregate_on_insert
  AFTER INSERT ON public.player_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rating_aggregate();

CREATE TRIGGER update_rating_aggregate_on_update
  AFTER UPDATE ON public.player_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rating_aggregate();

CREATE TRIGGER update_rating_aggregate_on_delete
  AFTER DELETE ON public.player_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rating_aggregate();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_match_participants_updated_at
  BEFORE UPDATE ON public.match_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_ratings_updated_at
  BEFORE UPDATE ON public.player_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();