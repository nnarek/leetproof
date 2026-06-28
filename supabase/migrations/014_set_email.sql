-- ============================================
-- Self-service email change
-- ============================================
-- Lets an authenticated user set/replace their own login email.
--
-- We cannot use the client-side `supabase.auth.updateUser({ email })` flow for
-- accounts that were created with a synthetic auth email
-- (e.g. `username@users.leetproof.local`). With "secure email change" enabled,
-- GoTrue tries to email a confirmation to the CURRENT address first, and the
-- `.local` TLD fails validation -> "Email address \"...@users.leetproof.local\"
-- is invalid". This function updates `auth.users` directly (and keeps
-- `public.profiles` in sync), confirming the new address immediately.

CREATE OR REPLACE FUNCTION public.set_my_email(new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
  normalized_email text := lower(trim(coalesce(new_email, '')));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF normalized_email = '' THEN
    RAISE EXCEPTION 'Email is required.';
  END IF;

  IF normalized_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'Email address "%" is invalid.', new_email;
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = normalized_email
      AND id <> uid
  ) THEN
    RAISE EXCEPTION 'That email is already in use.';
  END IF;

  UPDATE auth.users
  SET email = normalized_email,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = uid;

  UPDATE public.profiles
  SET email = normalized_email,
      auth_email = normalized_email,
      updated_at = now()
  WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_my_email(text) TO authenticated;
