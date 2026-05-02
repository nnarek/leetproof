"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import type { Submission } from "@/lib/types";
import SubmissionView from "@/components/SubmissionView";

interface SubmissionsListProps {
  problemId: string;
}

export default function SubmissionsList({ problemId }: SubmissionsListProps) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Submission | null>(null);

  const fetchSubmissions = useCallback(async () => {
    if (!user) {
      setSubmissions([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("problem_id", problemId)
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false });

    if (!error && data) {
      const subs = data as Submission[];
      setSubmissions(subs);

      // Auto-open submission from URL hash
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        const target = subs.find((s) => s.id === hash);
        if (target) setViewing(target);
      }
    }
    setLoading(false);
  }, [user, problemId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  useEffect(() => {
    const handleFocus = () => fetchSubmissions();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchSubmissions]);

  // Listen for new submission created from editor
  useEffect(() => {
    const handleNewSubmission = (e: Event) => {
      const sub = (e as CustomEvent).detail as Submission;
      if (sub && sub.problem_id === problemId) {
        setSubmissions((prev) => [sub, ...prev]);
        setViewing(sub);
        window.history.replaceState(null, "", `#${sub.id}`);
      }
    };
    window.addEventListener("leetlean:submission-created", handleNewSubmission);
    return () => window.removeEventListener("leetlean:submission-created", handleNewSubmission);
  }, [problemId]);

  const openSubmission = (sub: Submission) => {
    setViewing(sub);
    window.history.replaceState(null, "", `#${sub.id}`);
  };

  const closeSubmission = () => {
    setViewing(null);
    window.history.replaceState(null, "", window.location.pathname);
  };

  if (viewing) {
    return (
      <SubmissionView
        submission={viewing}
        problemId={problemId}
        onBack={closeSubmission}
        onDeleted={() => {
          setSubmissions((prev) => prev.filter((s) => s.id !== viewing.id));
          closeSubmission();
        }}
        onUpdated={(updated) => {
          setSubmissions((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s))
          );
          setViewing(updated);
        }}
      />
    );
  }

  if (!user) {
    return <p className="text-sm text-muted py-4">Sign in to see your submissions.</p>;
  }

  if (loading) {
    return <p className="text-sm text-muted py-4">Loading submissions...</p>;
  }

  if (submissions.length === 0) {
    return <p className="text-sm text-muted py-4">No submissions yet. Submit a proof from the editor.</p>;
  }

  return (
    <div className="relative overflow-hidden -mx-6">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-surface">
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted w-10">
              #
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">
              Name
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">
              Status
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">
              Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {submissions.map((sub, idx) => (
            <tr
              key={sub.id}
              onClick={() => openSubmission(sub)}
              className="transition hover:bg-hover cursor-pointer"
            >
              <td className="px-4 py-2.5 text-xs font-mono text-muted">
                {submissions.length - idx}
              </td>
              <td className="px-4 py-2.5 text-sm text-foreground truncate max-w-[200px]">
                {sub.name || "Unnamed submission"}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                    sub.status === "accepted"
                      ? "badge-success"
                      : sub.status === "wrong"
                        ? "badge-danger"
                        : "badge-warning"
                  }`}
                >
                  {sub.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right text-xs text-muted whitespace-nowrap">
                {new Date(sub.submitted_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
