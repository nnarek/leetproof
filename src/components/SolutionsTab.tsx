"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import type { SolutionWithMeta } from "@/lib/types";
import SolutionView from "@/components/SolutionView";

interface SolutionsTabProps {
  problemId: string;
  problemSlug: string;
}

export default function SolutionsTab({ problemId, problemSlug }: SolutionsTabProps) {
  const { user, loading: authLoading } = useAuth();
  const [solutions, setSolutions] = useState<SolutionWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showMine, setShowMine] = useState(false);
  const [viewingSolution, setViewingSolution] = useState<SolutionWithMeta | null>(null);
  const pendingSolutionIdRef = useRef<string | undefined>(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("id") ?? undefined
      : undefined
  );

  const fetchSolutions = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    const supabase = createClient();

    try {
      let query = supabase
        .from("solutions")
        .select("*")
        .eq("problem_id", problemId)
        .order("created_at", { ascending: false });

      if (showMine && user) {
        query = query.eq("user_id", user.id);
      }

      if (selectedTags.length > 0) {
        query = query.contains("tags", selectedTags);
      }

      const { data: solutionsData, error } = await query;

      if (error) {
        console.error("[SolutionsTab] query error:", error);
        setLoading(false);
        return;
      }

      if (!solutionsData || solutionsData.length === 0) {
        setSolutions([]);
        setAllTags([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for all solution authors
      const userIds = [...new Set(solutionsData.map((s: any) => s.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .in("id", userIds);
      const profilesMap: Record<string, { full_name: string | null; avatar_url: string | null; email: string | null }> = {};
      for (const p of profilesData || []) {
        profilesMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url, email: p.email };
      }

      // Fetch submission code for each solution
      const submissionIds = [...new Set(solutionsData.map((s: any) => s.submission_id))];
      const { data: submissionsData } = await supabase
        .from("submissions")
        .select("id, code, status")
        .in("id", submissionIds);
      const submissionsMap: Record<string, { code: string; status: string }> = {};
      for (const s of submissionsData || []) {
        submissionsMap[s.id] = { code: s.code, status: s.status };
      }

      // Fetch like counts
      const solutionIds = solutionsData.map((s: any) => s.id);
      const { data: likesData } = await supabase
        .from("solution_likes")
        .select("solution_id, user_id")
        .in("solution_id", solutionIds);

      const likeCounts: Record<string, number> = {};
      const userLikes = new Set<string>();
      for (const like of likesData || []) {
        likeCounts[like.solution_id] = (likeCounts[like.solution_id] || 0) + 1;
        if (user && like.user_id === user.id) {
          userLikes.add(like.solution_id);
        }
      }

      const enriched: SolutionWithMeta[] = solutionsData.map((s: any) => ({
        ...s,
        like_count: likeCounts[s.id] || 0,
        user_has_liked: userLikes.has(s.id),
        profiles: profilesMap[s.user_id] || { full_name: null, avatar_url: null },
        submissions: submissionsMap[s.submission_id] || { code: "", status: "pending" },
      }));

      // Sort by likes descending
      enriched.sort((a, b) => b.like_count - a.like_count);

      setSolutions(enriched);

      // If we have a pending solution ID to view, find and open it
      if (pendingSolutionIdRef.current) {
        const target = enriched.find((s) => s.id === pendingSolutionIdRef.current);
        if (target) {
          setViewingSolution(target);
        }
        pendingSolutionIdRef.current = undefined;
      }

      // Collect all tags
      const tagSet = new Set<string>();
      for (const s of enriched) {
        for (const t of s.tags) tagSet.add(t);
      }
      setAllTags(Array.from(tagSet).sort());
    } catch (err) {
      console.error("[SolutionsTab] unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, [problemId, user, authLoading, showMine, selectedTags]);

  useEffect(() => {
    fetchSolutions();
  }, [fetchSolutions]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleLike = async (solutionId: string) => {
    if (!user) return;
    const supabase = createClient();
    const solution = solutions.find((s) => s.id === solutionId);
    if (!solution) return;
    // Prevent self-liking
    if (solution.user_id === user.id) return;

    if (solution.user_has_liked) {
      await supabase
        .from("solution_likes")
        .delete()
        .eq("solution_id", solutionId)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("solution_likes")
        .insert({ solution_id: solutionId, user_id: user.id });
    }

    // Update solutions list
    setSolutions((prev) =>
      prev.map((s) =>
        s.id === solutionId
          ? {
              ...s,
              like_count: s.user_has_liked ? s.like_count - 1 : s.like_count + 1,
              user_has_liked: !s.user_has_liked,
            }
          : s
      )
    );

    // Also update the viewing solution if it matches
    if (viewingSolution?.id === solutionId) {
      setViewingSolution((prev) =>
        prev
          ? {
              ...prev,
              like_count: prev.user_has_liked ? prev.like_count - 1 : prev.like_count + 1,
              user_has_liked: !prev.user_has_liked,
            }
          : null
      );
    }
  };

  const openSolution = (sol: SolutionWithMeta) => {
    setViewingSolution(sol);
    const url = new URL(window.location.href);
    url.pathname = `/problems/${problemSlug}/solutions`;
    url.searchParams.set("id", sol.id);
    window.history.replaceState(null, "", url.toString());
  };

  const closeSolution = () => {
    setViewingSolution(null);
    const url = new URL(window.location.href);
    url.pathname = `/problems/${problemSlug}/solutions`;
    url.searchParams.delete("id");
    window.history.replaceState(null, "", url.toString());
    fetchSolutions();
  };

  if (viewingSolution) {
    return (
      <SolutionView
        solution={viewingSolution}
        onBack={closeSolution}
        onLike={() => handleLike(viewingSolution.id)}
        onUpdated={fetchSolutions}
      />
    );
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading solutions...</p>;
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {user && (
          <button
            onClick={() => setShowMine(!showMine)}
            className={`cursor-pointer inline-flex items-center rounded-md px-2 py-0.5 text-xs transition ${
              showMine
                ? "bg-accent/15 text-accent"
                : "bg-badge text-muted hover:text-foreground"
            }`}
          >
            My Solutions
          </button>
        )}
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`cursor-pointer inline-flex items-center rounded-md px-2 py-0.5 text-xs transition ${
              selectedTags.includes(tag)
                ? "bg-accent/15 text-accent"
                : "bg-badge text-muted hover:text-foreground"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {solutions.length === 0 ? (
        <p className="text-sm text-muted">
          {showMine ? "You haven't shared any solutions yet." : "No solutions shared yet. Be the first!"}
        </p>
      ) : (
        <div>
          {solutions.map((sol) => {
            const username = sol.profiles.email?.split("@")[0] || "anonymous";
            return (
              <button
                key={sol.id}
                onClick={() => openSolution(sol)}
                className="w-full text-left px-3 py-2.5 transition-colors hover:bg-hover cursor-pointer flex items-start gap-2.5"
              >
                {/* Avatar */}
                {sol.profiles.avatar_url ? (
                  <img
                    src={sol.profiles.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full shrink-0 mt-0.5"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-badge border border-border flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs text-muted">{username[0]?.toUpperCase()}</span>
                  </div>
                )}
                {/* Content */}
                <div className="min-w-0 flex-1">
                  {/* Row 1: username + visibility badge ... upvote (top-right) */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{username}</span>
                    {sol.user_id === user?.id && (
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 border ${
                        sol.is_public ? "badge-success" : "badge-warning"
                      }`}>
                        {sol.is_public ? "Public" : "Private"}
                      </span>
                    )}
                    <span
                      className={`ml-auto flex items-center gap-0.5 text-xs shrink-0 ${
                        sol.user_has_liked ? "text-accent" : "text-muted"
                      }`}
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 19V5M5 12l7-7 7 7" />
                      </svg>
                      {sol.like_count}
                    </span>
                  </div>
                  {/* Row 2: Title */}
                  <p className="text-sm font-medium text-foreground truncate mt-0.5">
                    {sol.title || "Untitled Solution"}
                  </p>
                  {/* Row 3: Tags ... date (bottom-right) */}
                  <div className="flex items-center gap-1 mt-1 min-h-[20px]">
                    <div className="flex flex-wrap gap-1 flex-1">
                      {sol.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-xs bg-badge text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-muted font-sans tabular-nums shrink-0">
                      {new Date(sol.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
