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
    // Handle OAuth callback: if an auth code is in the URL, exchange it
    // for a session client-side (works for both serverless and server modes).
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          // Clean the code from the URL
          window.history.replaceState({}, "", window.location.pathname);
        }
      });
    }

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await setCurrentUser(user);
      setLoading(false);
    };
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        await setCurrentUser(session?.user ?? null);
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
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
