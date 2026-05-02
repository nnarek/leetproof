"use client";

import { useEffect, useState } from "react";
import type { Problem } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import DifficultyBadge from "@/components/DifficultyBadge";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import SubmissionsList from "@/components/SubmissionsList";
import SolutionsTab from "@/components/SolutionsTab";

type Tab = "description" | "solutions" | "submissions";

interface ProblemTabsProps {
  problem: Problem;
  initialTab?: string;
}

export default function ProblemTabs({ problem, initialTab }: ProblemTabsProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(
    (initialTab === "solutions" || initialTab === "submissions") ? initialTab : "description"
  );
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    if (!user) { setSolved(false); return; }
    const supabase = createClient();
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("problem_id", problem.id)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .then(({ count }) => setSolved((count ?? 0) > 0));
  }, [user, problem.id]);

  // Auto-switch to submissions tab when a new submission is created
  useEffect(() => {
    const handleNewSubmission = () => {
      setActiveTab("submissions");
      window.history.replaceState(null, "", `/problems/${problem.slug}/submissions`);
    };
    window.addEventListener("leetlean:submission-created", handleNewSubmission);
    return () => window.removeEventListener("leetlean:submission-created", handleNewSubmission);
  }, [problem.slug]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "description", label: "Description" },
    { id: "solutions", label: "Solutions" },
    { id: "submissions", label: "Submissions" },
  ];

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "description") {
      window.history.replaceState(null, "", `/problems/${problem.slug}`);
    } else {
      window.history.replaceState(null, "", `/problems/${problem.slug}/${tab}`);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col border border-border bg-surface/30">
      {/* Header: title + difficulty + tags */}
      <div className="shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{problem.title}</h1>
          
          {solved && (
            <span className="inline-flex items-center gap-1 text-[var(--badge-success-text)]" title="Solved">
              <svg className="h-4 w-4" viewBox="0 0 448 512" fill="currentColor">
                <path d="M441 103c9.4 9.4 9.4 24.6 0 33.9L177 401c-9.4 9.4-24.6 9.4-33.9 0L7 265c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l119 119L407 103c9.4-9.4 24.6-9.4 33.9 0z" clip-rule="evenodd"></path>
              </svg>
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <DifficultyBadge difficulty={problem.difficulty} />
          {problem.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md bg-badge px-2 py-0.5 text-xs text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-border px-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={`min-h-0 flex-1 overflow-y-auto ${activeTab === "submissions" ? "px-6" : "px-6 py-4"}`}>
        {activeTab === "description" && (
          <MarkdownRenderer content={problem.description} />
        )}
        {activeTab === "solutions" && (
          <SolutionsTab
            problemId={problem.id}
            problemSlug={problem.slug}
          />
        )}
        {activeTab === "submissions" && (
          <SubmissionsList problemId={problem.id} />
        )}
      </div>
    </div>
  );
}
