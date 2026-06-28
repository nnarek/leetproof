"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  getPublicEmail,
  getSyntheticAuthEmail,
  isEmailLike,
  isSyntheticAuthEmail,
  isValidUsername,
  normalizeUsername,
} from "@/lib/profile";

interface AuthProfile {
  id: string;
  username: string | null;
  email: string | null;
  auth_email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface PasswordSignUpInput {
  username: string;
  email?: string;
  password: string;
}

// De-duplicates in-flight auth code exchanges. PKCE codes are single-use, so
// without this React StrictMode's double-invoked effect (dev) would exchange
// the same code twice — the second call fails and can leave the app without a
// session. Storing the promise lets the second run await the first instead.
type CodeExchangeResult = {
  data: { user: User | null } | null;
  error: { message: string } | null;
};
const codeExchanges = new Map<string, Promise<CodeExchangeResult>>();

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, email, auth_email, full_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    setProfile((data as AuthProfile | null) ?? null);
  }, [supabase]);

  const setCurrentUser = useCallback(async (nextUser: User | null) => {
    if (nextUser) {
      setProfile((currentProfile) => currentProfile?.id === nextUser.id ? currentProfile : null);
      setUser(nextUser);
      await loadProfile(nextUser.id);
    } else {
      setUser(null);
      setProfile(null);
    }
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;

    const cleanUrl = (preserveSearch: boolean) => {
      const search = preserveSearch ? window.location.search : "";
      window.history.replaceState({}, "", window.location.pathname + search);
    };

    // Establish a session from whatever the auth provider put in the URL:
    //  - PKCE / magic / recovery links: `?code=...` (exchange for a session)
    //  - implicit links: `#access_token=...&refresh_token=...` (set directly)
    // Returns true if a session was (or is being) established from the URL.
    const consumeUrlSession = async (): Promise<boolean> => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        // Reuse an in-flight exchange (StrictMode) instead of re-consuming the
        // single-use code, and await it so loading reflects the real result.
        let exchange = codeExchanges.get(code);
        if (!exchange) {
          exchange = supabase.auth.exchangeCodeForSession(code);
          codeExchanges.set(code, exchange);
        }

        const { data, error } = await exchange;
        if (error) {
          // Allow a retry if the exchange genuinely failed.
          codeExchanges.delete(code);
          console.error("Auth code exchange failed:", error.message);
          return false;
        }
        if (!cancelled) await setCurrentUser(data?.user ?? null);
        params.delete("code");
        const search = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (search ? `?${search}` : ""));
        return true;
      }

      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      if (hash) {
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.error("Failed to set session from URL hash:", error.message);
            return false;
          }
          if (!cancelled) await setCurrentUser(data.user ?? null);
          cleanUrl(true);
          return true;
        }
      }

      return false;
    };

    const init = async () => {
      const establishedFromUrl = await consumeUrlSession();
      if (cancelled) return;

      // If the URL didn't carry a session, fall back to the stored one.
      if (!establishedFromUrl) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        await setCurrentUser(user);
      }

      if (!cancelled) setLoading(false);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        await setCurrentUser(session?.user ?? null);
        setLoading(false);
      })();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setCurrentUser, supabase.auth]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const signInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const resolveAuthEmail = async (identifier: string) => {
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier) {
      throw new Error("Enter a username or email.");
    }

    if (isEmailLike(trimmedIdentifier)) {
      return trimmedIdentifier.toLowerCase();
    }

    const username = normalizeUsername(trimmedIdentifier);
    const { data, error } = await supabase
      .from("profiles")
      .select("auth_email, email")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      return getSyntheticAuthEmail(username);
    }

    return data?.auth_email || data?.email || getSyntheticAuthEmail(username);
  };

  const signInWithPassword = async (identifier: string, password: string) => {
    const email = await resolveAuthEmail(identifier);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    await setCurrentUser(data.user);
    return data;
  };

  const signUpWithPassword = async ({ username, email, password }: PasswordSignUpInput) => {
    const normalizedUsername = normalizeUsername(username);
    const publicEmail = email?.trim().toLowerCase() || null;

    if (!isValidUsername(normalizedUsername)) {
      throw new Error("Username must be 3-40 characters and can include letters, numbers, dot, underscore, and hyphen.");
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (existingProfile) {
      throw new Error("That username is already taken.");
    }

    const authEmail = publicEmail || getSyntheticAuthEmail(normalizedUsername);
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          username: normalizedUsername,
          full_name: normalizedUsername,
          profile_email: publicEmail,
        },
      },
    });

    if (error) throw error;
    if (data.user) await setCurrentUser(data.user);
    return data;
  };

  const resetPassword = async (identifier: string) => {
    const authEmail = await resolveAuthEmail(identifier);

    if (isSyntheticAuthEmail(authEmail)) {
      throw new Error("This username does not have an email address attached for password reset.");
    }

    const { error } = await supabase.auth.resetPasswordForEmail(getPublicEmail(authEmail) ?? authEmail, {
      redirectTo: `${window.location.origin}/login?mode=reset-password`,
    });

    if (error) throw error;
  };

  const updatePassword = async (password: string) => {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    await setCurrentUser(data.user);
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await setCurrentUser(null);
  };

  return {
    user,
    profile,
    loading,
    signInWithGoogle,
    signInWithGitHub,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,
    updatePassword,
    signOut,
  };
}
