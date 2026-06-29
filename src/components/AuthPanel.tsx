"use client";

import { useAuth } from "@/hooks/useAuth";
import { normalizeUsername, usernameFromEmail } from "@/lib/profile";
import { useEffect, useState } from "react";

type AuthMode = "signin" | "signup" | "forgot" | "update-password";

interface AuthPanelProps {
  onSuccess?: () => void;
}

interface StatusMessage {
  type: "error" | "success";
  text: string;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isInvalidCredentials(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("invalid login") || normalized.includes("invalid credentials");
}

export default function AuthPanel({ onSuccess }: AuthPanelProps) {
  const {
    user,
    signInWithGoogle,
    signInWithGitHub,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,
    updatePassword,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [signInIdentifier, setSignInIdentifier] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState("");

  const [resetIdentifier, setResetIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    if (params.get("mode") === "reset-password") {
      setMode("update-password");
    }

    const errorCode = params.get("error_code") ?? hashParams.get("error_code");
    const errorDescription =
      params.get("error_description") ?? hashParams.get("error_description");
    const error = params.get("error") ?? hashParams.get("error");

    if (error || errorCode || errorDescription) {
      const description = errorDescription ?? "This link is invalid or has expired.";
      const expired = errorCode === "otp_expired";
      setStatus({
        type: "error",
        text: expired
          ? `${description}. Password reset links can only be used once and expire after a short time. Please request a new reset email.`
          : description,
      });
    }
  }, []);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setStatus(null);
  };

  const moveSignInValuesToSignUp = () => {
    const identifier = signInIdentifier.trim();
    if (identifier.includes("@")) {
      setSignUpEmail(identifier);
      setSignUpUsername(usernameFromEmail(identifier));
    } else {
      setSignUpUsername(normalizeUsername(identifier));
    }
    setSignUpPassword(signInPassword);
    setSignUpPasswordConfirm("");
    setMode("signup");
  };

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setSubmitting(true);

    try {
      await signInWithPassword(signInIdentifier, signInPassword);
      setStatus({ type: "success", text: "Signed in." });
      onSuccess?.();
    } catch (error) {
      const message = errorMessage(error);
      if (isInvalidCredentials(message)) {
        moveSignInValuesToSignUp();
        setStatus({
          type: "error",
          text: "No account matched those credentials. Complete the remaining fields to sign up.",
        });
      } else {
        setStatus({ type: "error", text: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (signUpPassword !== signUpPasswordConfirm) {
      setStatus({ type: "error", text: "Passwords do not match." });
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUpWithPassword({
        username: signUpUsername,
        email: signUpEmail,
        password: signUpPassword,
      });

      if (result.session) {
        setStatus({ type: "success", text: "Account created." });
        onSuccess?.();
      } else if (signUpEmail.trim()) {
        setStatus({ type: "success", text: "Check your email to confirm the account." });
      } else {
        setStatus({ type: "success", text: "Account created. Sign in with your username and password." });
        setMode("signin");
      }
    } catch (error) {
      setStatus({ type: "error", text: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setSubmitting(true);

    try {
      await resetPassword(resetIdentifier);
      setStatus({ type: "success", text: "Password reset email sent." });
    } catch (error) {
      setStatus({ type: "error", text: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (newPassword !== newPasswordConfirm) {
      setStatus({ type: "error", text: "Passwords do not match." });
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(newPassword);
      setStatus({ type: "success", text: "Password updated." });
      setMode("signin");
    } catch (error) {
      setStatus({ type: "error", text: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const startPasswordReset = () => {
    setResetIdentifier(signInIdentifier);
    switchMode("forgot");
  };

  const activeSection = mode === "signup" ? "signup" : "signin";

  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-2xl">
      <div className="grid grid-cols-2 rounded-md border border-border bg-background p-1">
        <button
          type="button"
          onClick={() => switchMode("signin")}
          className={`rounded px-3 py-2 text-sm font-medium transition ${
            activeSection === "signin"
              ? "bg-accent text-white"
              : "text-muted hover:bg-hover hover:text-foreground"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={`rounded px-3 py-2 text-sm font-medium transition ${
            activeSection === "signup"
              ? "bg-accent text-white"
              : "text-muted hover:bg-hover hover:text-foreground"
          }`}
        >
          Sign Up
        </button>
      </div>

      <div className="mt-6">
        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="signin-identifier">
                Username or email
              </label>
              <input
                id="signin-identifier"
                value={signInIdentifier}
                onChange={(event) => setSignInIdentifier(event.target.value)}
                autoComplete="username"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="signin-password">
                Password
              </label>
              <input
                id="signin-password"
                value={signInPassword}
                onChange={(event) => setSignInPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                required
              />
              <button
                type="button"
                onClick={startPasswordReset}
                className="mt-2 text-xs font-medium text-accent transition hover:text-accent/80"
              >
                Forgot password?
              </button>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="signup-username">
                Username
              </label>
              <input
                id="signup-username"
                value={signUpUsername}
                onChange={(event) => setSignUpUsername(event.target.value)}
                autoComplete="username"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="signup-email">
                Email {/*  <span className="font-normal text-muted">optional</span> */}
              </label>
              <input
                id="signup-email"
                value={signUpEmail}
                onChange={(event) => setSignUpEmail(event.target.value)}
                type="email"
                autoComplete="email"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="signup-password">
                Password
              </label>
              <input
                id="signup-password"
                value={signUpPassword}
                onChange={(event) => setSignUpPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="signup-password-confirm">
                Confirm password
              </label>
              <input
                id="signup-password-confirm"
                value={signUpPasswordConfirm}
                onChange={(event) => setSignUpPasswordConfirm(event.target.value)}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating account..." : "Sign Up"}
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="reset-identifier">
                Email or username
              </label>
              <input
                id="reset-identifier"
                value={resetIdentifier}
                onChange={(event) => setResetIdentifier(event.target.value)}
                autoComplete="username"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Send reset email"}
            </button>
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="w-full text-center text-sm text-muted transition hover:text-foreground"
            >
              Back to sign in
            </button>
          </form>
        )}

        {mode === "update-password" && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {!user && (
              <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted">
                Finishing password reset session...
              </p>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="new-password-confirm">
                Confirm new password
              </label>
              <input
                id="new-password-confirm"
                value={newPasswordConfirm}
                onChange={(event) => setNewPasswordConfirm(event.target.value)}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !user}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </div>

      {status && (
        <p
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            status.type === "success"
              ? "badge-success"
              : "badge-danger"
          }`}
        >
          {status.text}
        </p>
      )}

      <div className="mt-6 border-t border-border pt-4">
        <div className="space-y-3">
          <button
            onClick={signInWithGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-hover"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
          <button
            onClick={signInWithGitHub}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-hover"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>
        </div>
      </div>
    </div>
  );
}