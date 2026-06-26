"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * OAuth callback page.
 *
 * Supabase redirects here with ?code=... after the user signs in with Google.
 * This client component exchanges the code for a session, then navigates home.
 * Works identically in both serverless (static export) and SSR modes.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    document.title = "Signing in... - LeetProof";
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error("Auth callback error:", error.message);
          router.replace("/?error=auth_callback_error");
        } else {
          router.replace("/");
        }
      });
    } else {
      router.replace("/");
    }
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-zinc-400">Signing you in...</p>
    </div>
  );
}
