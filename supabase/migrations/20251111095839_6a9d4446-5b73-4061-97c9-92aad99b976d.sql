-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to hash league passwords using bcrypt
CREATE OR REPLACE FUNCTION public.hash_league_password()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only hash if password is not null, not empty, and doesn't look like a bcrypt hash already
  IF NEW.password IS NOT NULL 
     AND NEW.password != '' 
     AND NOT (NEW.password LIKE '$2%' AND LENGTH(NEW.password) = 60) THEN
    -- Hash the password using bcrypt (using crypt with bf algorithm)
    NEW.password := crypt(NEW.password, gen_salt('bf', 10));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS hash_league_password_trigger ON public.leagues;

-- Create trigger to hash passwords before insert or update
CREATE TRIGGER hash_league_password_trigger
  BEFORE INSERT OR UPDATE OF password ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_league_password();