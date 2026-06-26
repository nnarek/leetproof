"use client";

import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import type { Difficulty, Profile } from "@/lib/types";
import {
  emptyDifficultyStats,
  getGeneratedAvatarBackground,
  getProfileDisplayName,
  getProfileInitials,
  getPublicEmail,
  isValidUsername,
  normalizeUsername,
  type DifficultyStat,
} from "@/lib/profile";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface UserProfileClientProps {
  userId: string;
}

type EditableProfile = Pick<
  Profile,
  "id" | "username" | "email" | "auth_email" | "full_name" | "avatar_url" | "created_at" | "updated_at"
>;

type ProfileUpdate = Partial<Pick<Profile, "username" | "email" | "auth_email" | "full_name" | "avatar_url">>;

const difficultyLabels: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const difficultyFillColors: Record<Difficulty, string> = {
  easy: "var(--success)",
  medium: "var(--warning)",
  hard: "var(--danger)",
};

const difficultyBadgeClasses: Record<Difficulty, string> = {
  easy: "difficulty-easy",
  medium: "difficulty-medium",
  hard: "difficulty-hard",
};

function normalizeStats(rows: DifficultyStat[]) {
  const byDifficulty = new Map(rows.map((row) => [row.difficulty, row]));
  return emptyDifficultyStats().map((row) => byDifficulty.get(row.difficulty) ?? row);
}

function UserPageAvatar({
  name,
  avatarUrl,
  size = 96,
}: {
  name: string | null | undefined;
  avatarUrl: string | null | undefined;
  size?: number;
}) {
  const displayName = name ?? "anonymous";
  const px = `${size}px`;

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={displayName}
        style={{ width: px, height: px }}
        className="rounded-full border border-border object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      style={{
        width: px,
        height: px,
        background: getGeneratedAvatarBackground(displayName),
        fontSize: size * 0.45,
      }}
      className="flex items-center justify-center rounded-full border border-border font-semibold text-white shadow-inner"
      aria-label={displayName}
      role="img"
    >
      {getProfileInitials(displayName)}
    </div>
  );
}

function DifficultyBarChart({ stats }: { stats: DifficultyStat[] }) {
  const totalSolved = stats.reduce((sum, row) => sum + row.solved_count, 0);
  const totalAvailable = stats.reduce((sum, row) => sum + row.total_count, 0);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Problems solved</h2>
        <span className="text-sm text-muted">
          {totalSolved} / {totalAvailable}
        </span>
      </div>
      <div className="space-y-2.5">
        {stats.map((row) => {
          const percent = row.total_count > 0 ? (row.solved_count / row.total_count) * 100 : 0;

          return (
            <div key={row.difficulty} className="flex items-center gap-3">
              <div className="w-16 shrink-0">
                <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${difficultyBadgeClasses[row.difficulty]}`}>
                  {difficultyLabels[row.difficulty]}
                </span>
              </div>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-hover">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: difficultyFillColors[row.difficulty],
                  }}
                />
              </div>
              <div className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
                {row.solved_count} / {row.total_count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function UserProfileClient({ userId }: UserProfileClientProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [stats, setStats] = useState<DifficultyStat[]>(emptyDifficultyStats());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const isOwner = user?.id === userId;

  const fetchStatsFallback = useCallback(async () => {
    const supabase = createClient();
    const { data: problemsData } = await supabase.from("problems").select("id, difficulty");
    const problemRows = (problemsData ?? []) as { id: string; difficulty: Difficulty }[];
    const solvedProblemIds = new Set<string>();

    if (user?.id === userId) {
      const { data: submissionsData } = await supabase
        .from("submissions")
        .select("problem_id")
        .eq("user_id", userId)
        .eq("status", "accepted");

      for (const row of submissionsData ?? []) {
        solvedProblemIds.add(row.problem_id);
      }
    }

    return emptyDifficultyStats().map((stat) => {
      const problemsForDifficulty = problemRows.filter((problem) => problem.difficulty === stat.difficulty);
      return {
        difficulty: stat.difficulty,
        total_count: problemsForDifficulty.length,
        solved_count: problemsForDifficulty.filter((problem) => solvedProblemIds.has(problem.id)).length,
      };
    });
  }, [user?.id, userId]);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, email, auth_email, full_name, avatar_url, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profileData) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const nextProfile = profileData as EditableProfile;
    setProfile(nextProfile);
    setUsername(nextProfile.username ?? "");
    setEmail(getPublicEmail(nextProfile.email) ?? "");
    setAvatarUrl(nextProfile.avatar_url ?? "");

    const { data: statsData, error: statsError } = await supabase.rpc("get_user_difficulty_stats", {
      profile_user_id: userId,
    });

    if (!statsError && statsData) {
      setStats(
        normalizeStats(
          (statsData as { difficulty: Difficulty; total_count: number; solved_count: number }[]).map((row) => ({
            difficulty: row.difficulty,
            total_count: Number(row.total_count),
            solved_count: Number(row.solved_count),
          }))
        )
      );
    } else {
      setStats(await fetchStatsFallback());
    }

    setLoading(false);
  }, [fetchStatsFallback, userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted placeholder:opacity-50 focus:border-accent focus:outline-none";

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !isOwner) return;

    const nextUsername = normalizeUsername(username);
    if (!isValidUsername(nextUsername)) {
      setStatus({
        type: "error",
        text: "Username must be 3-40 characters and can use letters, numbers, dot, underscore, and hyphen.",
      });
      return;
    }

    setSaving(true);
    setStatus(null);
    const supabase = createClient();
    const nextEmail = email.trim() || null;
    const updates: ProfileUpdate = {
      username: nextUsername,
      full_name: nextUsername,
      avatar_url: avatarUrl.trim() || null,
      email: nextEmail,
    };

    try {
      if (nextEmail && nextEmail !== getPublicEmail(profile.email)) {
        const { data: updateData, error: updateError } = await supabase.auth.updateUser({ email: nextEmail });
        if (updateError) throw updateError;
        if (updateData.user?.email === nextEmail) {
          updates.auth_email = nextEmail;
        }
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (profileError) throw profileError;
      setStatus({ type: "success", text: "Profile updated." });
      setEditing(false);
      await fetchProfile();
    } catch (error) {
      setStatus({ type: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!profile) return;
    setUsername(profile.username ?? "");
    setEmail(getPublicEmail(profile.email) ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
    setEditing(false);
    setStatus(null);
  };

  const handleDownloadArchive = async () => {
    if (!profile || !isOwner) return;

    setDownloading(true);
    setStatus(null);

    try {
      const supabase = createClient();
      const [submissions, solutions, hintPacks, problems] = await Promise.all([
        supabase.from("submissions").select("*").eq("user_id", profile.id),
        supabase.from("solutions").select("*").eq("user_id", profile.id),
        supabase.from("hint_packs").select("*").eq("user_id", profile.id),
        supabase.from("problems").select("id, slug"),
      ]);

      if (submissions.error) throw submissions.error;
      if (solutions.error) throw solutions.error;
      if (hintPacks.error) throw hintPacks.error;
      if (problems.error) throw problems.error;

      const slugById: Record<string, string> = {};
      for (const problem of problems.data ?? []) {
        slugById[problem.id] = problem.slug;
      }

      const withSlug = <T extends { problem_id: string }>(rows: T[] | null) =>
        (rows ?? []).map((row) => ({ ...row, problem_slug: slugById[row.problem_id] ?? null }));

      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      zip.file("profile.json", JSON.stringify(profile, null, 2));
      zip.file("submissions.json", JSON.stringify(withSlug(submissions.data), null, 2));
      zip.file("solutions.json", JSON.stringify(withSlug(solutions.data), null, 2));
      zip.file("hint_packs.json", JSON.stringify(withSlug(hintPacks.data), null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `leetproof-${profile.username ?? profile.id}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setStatus({ type: "error", text: error instanceof Error ? error.message : "Failed to build archive." });
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!profile || !isOwner) return;

    const confirmation = window.prompt(
      `This permanently deletes your account, submissions, solutions, hint packs, and comments. Type your username (${profile.username}) to confirm:`
    );

    if (confirmation === null) return;

    if (confirmation.trim().toLowerCase() !== (profile.username ?? "").toLowerCase()) {
      setStatus({ type: "error", text: "Username did not match. Account not deleted." });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;

      await signOut();
      router.push("/");
    } catch (error) {
      setStatus({ type: "error", text: error instanceof Error ? error.message : "Failed to delete account." });
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (loading) {
    return <p className="text-sm text-muted"></p>;
  }

  if (!profile) {
    return <p className="text-sm text-muted">User not found.</p>;
  }

  const displayEmail = getPublicEmail(profile.email);
  const avatarName = getProfileDisplayName(profile);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="shrink-0">
            <UserPageAvatar
              name={avatarName}
              avatarUrl={editing ? avatarUrl || null : profile.avatar_url}
              size={96}
            />
          </div>

          <div className="flex-1">
            {!editing && (
              <>
                <h1 className="text-2xl font-semibold text-foreground">
                  {profile.username || "(no username)"}
                </h1>
                {profile.full_name && (
                  <p className="mt-0.5 text-sm text-muted">{profile.full_name}</p>
                )}
                {isOwner && displayEmail && (
                  <p className="mt-2 text-sm text-foreground">{displayEmail}</p>
                )}
                {isOwner && !displayEmail && (
                  <p className="mt-2 text-sm italic text-muted">
                    No email set. Add one to enable password reset.
                  </p>
                )}
              </>
            )}
            {isOwner && (
              <div className={`mt-4 flex flex-wrap gap-2${editing ? " invisible pointer-events-none h-0 !mt-0" : ""}`}
                aria-hidden={editing}
              >
                <button
                  onClick={() => {
                    setStatus(null);
                    setEditing(true);
                  }}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent/90"
                >
                  Edit profile
                </button>
                <button
                  onClick={handleDownloadArchive}
                  disabled={downloading}
                  className="rounded-md bg-hover px-3 py-1.5 text-sm text-foreground transition hover:bg-border disabled:opacity-50"
                >
                  {downloading ? "Preparing..." : "Download my data"}
                </button>
                <button
                  onClick={handleSignOut}
                  className="rounded-md bg-hover px-3 py-1.5 text-sm text-muted transition hover:bg-border hover:text-foreground"
                >
                  Sign Out
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-1.5 text-sm font-medium text-[var(--danger)] transition hover:bg-[var(--danger)]/20 disabled:opacity-50"
                >
                  Delete account
                </button>
              </div>
            )}
            {editing && (
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted" htmlFor="profile-username">
                    Username
                  </label>
                  <input
                    id="profile-username"
                    className={inputClass}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    disabled={saving}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted" htmlFor="profile-email">
                    Email
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    className={inputClass}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={saving}
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted" htmlFor="profile-avatar">
                    Avatar URL
                  </label>
                  <input
                    id="profile-avatar"
                    className={inputClass}
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    disabled={saving}
                    placeholder="https://..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="rounded-md bg-hover px-3 py-1.5 text-sm text-foreground transition hover:bg-border disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {status && (
              <p className={`mt-3 rounded-md border px-3 py-2 text-sm ${status.type === "success" ? "badge-success" : "badge-danger"}`}>
                {status.text}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <DifficultyBarChart stats={stats} />
      </div>
    </div>
  );
}