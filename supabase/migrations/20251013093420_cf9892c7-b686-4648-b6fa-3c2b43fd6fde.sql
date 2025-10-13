-- Create league_role enum
CREATE TYPE public.league_role AS ENUM ('admin', 'plačan_član', 'neplačan_član');

-- Create leagues table
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- Create league_members table (stores user roles per league)
CREATE TABLE public.league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role league_role NOT NULL DEFAULT 'neplačan_član',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

-- Add league_id to matches table
ALTER TABLE public.matches ADD COLUMN league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE;

-- Update matches to require league_id (after data migration if needed)
ALTER TABLE public.matches ALTER COLUMN league_id SET NOT NULL;

-- RLS Policies for leagues
CREATE POLICY "Leagues are viewable by everyone"
  ON public.leagues FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create leagues"
  ON public.leagues FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "League creators can update their leagues"
  ON public.leagues FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "League creators can delete their leagues"
  ON public.leagues FOR DELETE
  USING (auth.uid() = created_by);

-- Security definer function to check league role
CREATE OR REPLACE FUNCTION public.has_league_role(_user_id UUID, _league_id UUID, _role league_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.league_members
    WHERE user_id = _user_id
      AND league_id = _league_id
      AND role = _role
  )
$$;

-- Security definer function to check if user is league admin
CREATE OR REPLACE FUNCTION public.is_league_admin(_user_id UUID, _league_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.league_members
    WHERE user_id = _user_id
      AND league_id = _league_id
      AND role = 'admin'
  )
$$;

-- Security definer function to check if user is league member
CREATE OR REPLACE FUNCTION public.is_league_member(_user_id UUID, _league_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.league_members
    WHERE user_id = _user_id
      AND league_id = _league_id
  )
$$;

-- RLS Policies for league_members
CREATE POLICY "League members are viewable by league members"
  ON public.league_members FOR SELECT
  USING (public.is_league_member(auth.uid(), league_id));

CREATE POLICY "Users can join leagues"
  ON public.league_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update member roles"
  ON public.league_members FOR UPDATE
  USING (public.is_league_admin(auth.uid(), league_id));

CREATE POLICY "Admins can remove members"
  ON public.league_members FOR DELETE
  USING (public.is_league_admin(auth.uid(), league_id) OR auth.uid() = user_id);

-- Update matches RLS policies to be league-specific
DROP POLICY IF EXISTS "Matches are viewable by everyone" ON public.matches;
DROP POLICY IF EXISTS "Authenticated users can create matches" ON public.matches;
DROP POLICY IF EXISTS "Match creators can update their matches" ON public.matches;
DROP POLICY IF EXISTS "Match creators can delete their matches" ON public.matches;

CREATE POLICY "Matches viewable by league members"
  ON public.matches FOR SELECT
  USING (public.is_league_member(auth.uid(), league_id));

CREATE POLICY "League admins can create matches"
  ON public.matches FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    public.is_league_admin(auth.uid(), league_id)
  );

CREATE POLICY "League admins can update matches"
  ON public.matches FOR UPDATE
  USING (public.is_league_admin(auth.uid(), league_id));

CREATE POLICY "League admins can delete matches"
  ON public.matches FOR DELETE
  USING (public.is_league_admin(auth.uid(), league_id));

-- Update match_participants RLS policies
DROP POLICY IF EXISTS "Match participants are viewable by everyone" ON public.match_participants;

CREATE POLICY "Match participants viewable by league members"
  ON public.match_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = match_participants.match_id
        AND public.is_league_member(auth.uid(), matches.league_id)
    )
  );

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_leagues_updated_at
  BEFORE UPDATE ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_league_members_updated_at
  BEFORE UPDATE ON public.league_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically make league creator an admin
CREATE OR REPLACE FUNCTION public.handle_new_league()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_league_created
  AFTER INSERT ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_league();