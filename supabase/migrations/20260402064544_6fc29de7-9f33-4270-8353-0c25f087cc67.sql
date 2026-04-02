
CREATE TABLE public.season_member_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'neplačan_član' CHECK (role IN ('plačan_član', 'neplačan_član')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(season_id, user_id)
);

ALTER TABLE public.season_member_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "League members can view season roles"
  ON public.season_member_roles FOR SELECT TO authenticated
  USING (is_league_member(auth.uid(), league_id));

CREATE POLICY "League admins can insert season roles"
  ON public.season_member_roles FOR INSERT TO authenticated
  WITH CHECK (is_league_admin(auth.uid(), league_id));

CREATE POLICY "League admins can update season roles"
  ON public.season_member_roles FOR UPDATE TO authenticated
  USING (is_league_admin(auth.uid(), league_id));

CREATE POLICY "League admins can delete season roles"
  ON public.season_member_roles FOR DELETE TO authenticated
  USING (is_league_admin(auth.uid(), league_id));
