-- Drop the restrictive policy that only allows viewing leagues you're a member of
DROP POLICY IF EXISTS "League members can view leagues" ON public.leagues;

-- Create a new policy that allows all authenticated users to view all leagues
CREATE POLICY "Authenticated users can view all leagues"
ON public.leagues
FOR SELECT
TO authenticated
USING (true);