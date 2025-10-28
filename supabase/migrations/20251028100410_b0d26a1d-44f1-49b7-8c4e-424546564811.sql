-- =====================================================
-- SECURITY FIX: Separate User Roles Table
-- =====================================================
-- This migration addresses critical security issues:
-- 1. Moves user roles from profiles table to dedicated user_roles table
-- 2. Restricts league visibility to members only

-- Step 1: Create app_role enum for system-wide roles
CREATE TYPE public.app_role AS ENUM ('admin', 'paid_member', 'unpaid_member');

-- Step 2: Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Step 3: Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 4: Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT 
  id,
  CASE 
    WHEN role = 'administrator' THEN 'admin'::app_role
    WHEN role = 'neplačan_član' THEN 'unpaid_member'::app_role
    ELSE 'unpaid_member'::app_role
  END
FROM public.profiles;

-- Step 5: Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 6: Add RLS policies to user_roles
-- Only admins can modify roles
CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Step 7: Drop role column from profiles (no longer needed)
ALTER TABLE public.profiles DROP COLUMN role;

-- Step 8: Update handle_new_user trigger function to use user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert into profiles without role
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Initialize rating aggregate
  INSERT INTO public.rating_aggregates (player_id)
  VALUES (NEW.id);
  
  -- Assign default unpaid_member role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'unpaid_member');
  
  RETURN NEW;
END;
$function$;

-- =====================================================
-- SECURITY FIX: Restrict League Visibility
-- =====================================================

-- Step 9: Drop overly permissive league policy
DROP POLICY IF EXISTS "Authenticated users can view leagues" ON public.leagues;

-- Step 10: Create member-only policy for league visibility
CREATE POLICY "League members can view leagues"
ON public.leagues FOR SELECT
USING (public.is_league_member(auth.uid(), id));

-- Step 11: Add trigger for updating user_roles timestamps
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();