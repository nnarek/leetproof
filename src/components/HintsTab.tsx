"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import type { HintPackWithMeta, ParsedHint, ParsedHintStep } from "@/lib/types";
import { parseHintPackYaml, applyStep, forceApplyStep, getStepStatuses, getAllCompletions } from "@/lib/hints";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface HintsTabProps {
  problemId: string;
  problemSlug: string;
}

export default function HintsTab({ problemId, problemSlug }: HintsTabProps) {
  const { user, loading: authLoading } = useAuth();
  const [hintPacks, setHintPacks] = useState<HintPackWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [yamlInput, setYamlInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const userCollapsedRef = useRef(false);

  const fetchHintPacks = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    const supabase = createClient();

    try {
      const { data: packsData, error } = await supabase
        .from("hint_packs")
        .select("*")
        .eq("problem_id", problemId)
        .order("created_at", { ascending: false });

      if (error || !packsData) {
        setHintPacks([]);
        setLoading(false);
        return;
      }

      // Fetch profiles
      const userIds = [...new Set(packsData.map((p: any) => p.user_id))];
      const { data: profilesData } = userIds.length > 0
        ? await supabase.from("profiles").select("id, full_name, avatar_url, email").in("id", userIds)
        : { data: [] };
      const profilesMap: Record<string, { full_name: string | null; avatar_url: string | null; email: string | null }> = {};
      for (const p of profilesData || []) {
        profilesMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url, email: p.email };
      }

      // Fetch likes
      const packIds = packsData.map((p: any) => p.id);
      const { data: likesData } = packIds.length > 0
        ? await supabase.from("hint_pack_likes").select("hint_pack_id, user_id").in("hint_pack_id", packIds)
        : { data: [] };

      const likeCounts: Record<string, number> = {};
      const userLikes = new Set<string>();
      for (const like of likesData || []) {
        likeCounts[like.hint_pack_id] = (likeCounts[like.hint_pack_id] || 0) + 1;
        if (user && like.user_id === user.id) {
          userLikes.add(like.hint_pack_id);
        }
      }

      const enriched: HintPackWithMeta[] = packsData.map((p: any) => ({
        ...p,
        like_count: likeCounts[p.id] || 0,
        user_has_liked: userLikes.has(p.id),
        profiles: profilesMap[p.user_id] || { full_name: null, avatar_url: null, email: null },
        parsed: parseHintPackYaml(p.yaml_content),
      }));

      // Sort by likes descending
      enriched.sort((a, b) => b.like_count - a.like_count);

      setHintPacks(enriched);

      // Auto-expand on first load only if user hasn't manually collapsed
      if (!initializedRef.current && enriched.length > 0 && !userCollapsedRef.current) {
        // Check URL for specific pack id
        const url = new URL(window.location.href);
        const packIdFromUrl = url.searchParams.get("id");
        if (packIdFromUrl && enriched.find((p) => p.id === packIdFromUrl)) {
          setExpandedPackId(packIdFromUrl);
        } else {
          setExpandedPackId(enriched[0].id);
        }
        initializedRef.current = true;
      }
    } catch (err) {
      console.error("[HintsTab] error:", err);
    } finally {
      setLoading(false);
    }
  }, [problemId, user, authLoading]);

  useEffect(() => {
    fetchHintPacks();
  }, [fetchHintPacks]);

  // Update URL when expanded pack changes
  useEffect(() => {
    if (!initializedRef.current) return;
    const url = new URL(window.location.href);
    if (expandedPackId) {
      url.pathname = `/problems/${problemSlug}/hints`;
      url.searchParams.set("id", expandedPackId);
    } else {
      url.pathname = `/problems/${problemSlug}/hints`;
      url.searchParams.delete("id");
    }
    window.history.replaceState(null, "", url.toString());
  }, [expandedPackId, problemSlug]);

  const handleLike = async (packId: string) => {
    if (!user) return;
    const supabase = createClient();
    const pack = hintPacks.find((p) => p.id === packId);
    if (!pack) return;
    // Prevent self-liking
    if (pack.user_id === user.id) return;

    if (pack.user_has_liked) {
      await supabase
        .from("hint_pack_likes")
        .delete()
        .eq("hint_pack_id", packId)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("hint_pack_likes")
        .insert({ hint_pack_id: packId, user_id: user.id });
    }

    setHintPacks((prev) =>
      prev.map((p) =>
        p.id === packId
          ? {
              ...p,
              like_count: p.user_has_liked ? p.like_count - 1 : p.like_count + 1,
              user_has_liked: !p.user_has_liked,
            }
          : p
      )
    );
  };

  const handleSubmitHintPack = async () => {
    if (!user || !yamlInput.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    const parsed = parseHintPackYaml(yamlInput);
    if (!parsed || parsed.hints.length === 0) {
      setSubmitError("Invalid YAML format. Must have a 'hints' array with at least one hint.");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();

    if (editingPackId) {
      // Update existing pack
      const { error } = await supabase
        .from("hint_packs")
        .update({ yaml_content: yamlInput.trim(), updated_at: new Date().toISOString() })
        .eq("id", editingPackId)
        .eq("user_id", user.id);

      if (error) {
        setSubmitError(`Failed to update: ${error.message}`);
      } else {
        setYamlInput("");
        setEditingPackId(null);
        setShowAddForm(false);
        fetchHintPacks();
      }
    } else {
      // Create new pack
      const { error } = await supabase.from("hint_packs").insert({
        user_id: user.id,
        problem_id: problemId,
        yaml_content: yamlInput.trim(),
      });

      if (error) {
        setSubmitError(`Failed to save: ${error.message}`);
      } else {
        setYamlInput("");
        setShowAddForm(false);
        fetchHintPacks();
      }
    }
    setSubmitting(false);
  };

  const handleDeletePack = async (packId: string) => {
    if (!user) return;
    if (!window.confirm("Delete this hint pack? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("hint_packs").delete().eq("id", packId).eq("user_id", user.id);
    setEditingPackId(null);
    setShowAddForm(false);
    setYamlInput("");
    fetchHintPacks();
  };

  const startEdit = (pack: HintPackWithMeta) => {
    setEditingPackId(pack.id);
    setYamlInput(pack.yaml_content);
    setShowAddForm(true);
    setSubmitError(null);
  };

  const togglePack = (packId: string) => {
    setExpandedPackId((prev) => {
      if (prev === packId) {
        userCollapsedRef.current = true;
        return null;
      }
      return packId;
    });
  };

  if (loading) {
    return <p className="text-sm text-muted">Loading hints...</p>;
  }

  return (
    <div>
      {hintPacks.length === 0 && !showAddForm && (
        <p className="text-sm text-muted mb-3">No hint packs yet. Be the first to add one!</p>
      )}

      {hintPacks.map((pack) => {
        const isExpanded = expandedPackId === pack.id;
        const username = pack.profiles.email?.split("@")[0] || "anonymous";
        const packName = pack.parsed?.name || `Hint Pack by ${username}`;
        const isOwner = user?.id === pack.user_id;

        return (
          <div key={pack.id} className="border border-border rounded-md mb-2 overflow-hidden">
            {/* Pack header */}
            <button
              onClick={() => togglePack(pack.id)}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-hover transition-colors cursor-pointer"
            >
              {/* Expand chevron */}
              <svg
                className={`h-4 w-4 text-muted transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>

              {/* Avatar */}
              {pack.profiles.avatar_url ? (
                <img
                  src={pack.profiles.avatar_url}
                  alt=""
                  className="h-6 w-6 rounded-full shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-badge border border-border flex items-center justify-center shrink-0">
                  <span className="text-[10px] text-muted">{username[0]?.toUpperCase()}</span>
                </div>
              )}

              <span className="text-sm text-foreground flex-1 truncate">
                <span className="font-medium">{packName}</span>
                <span className="text-muted ml-1.5 text-xs">by {username}</span>
              </span>

              {/* Edit button for owner */}
              {isOwner && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(pack);
                  }}
                  className="text-muted hover:text-foreground cursor-pointer shrink-0"
                  title="Edit hint pack"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </span>
              )}

              {/* Like button */}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleLike(pack.id);
                }}
                className={`flex items-center gap-0.5 text-xs shrink-0 cursor-pointer ${
                  pack.user_has_liked ? "text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                {pack.like_count}
              </span>
            </button>

            {/* Expanded content */}
            {isExpanded && pack.parsed && (
              <div className="border-t border-border px-4 py-3">
                <HintPackContent hints={pack.parsed.hints} />
              </div>
            )}
            {isExpanded && !pack.parsed && (
              <div className="border-t border-border px-4 py-3">
                <p className="text-sm text-red-500">Failed to parse hint pack YAML.</p>
              </div>
            )}
          </div>
        );
      })}

      {/* Add / Edit hint pack form */}
      {!showAddForm ? (
        <button
          onClick={() => { setShowAddForm(true); setEditingPackId(null); setYamlInput(""); setSubmitError(null); }}
          className="mt-3 w-full px-4 py-2.5 border border-dashed border-border rounded-md text-sm text-muted hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
        >
          + Add Hint Pack
        </button>
      ) : (
        <div className="mt-3 border border-border rounded-md p-4">
          <h3 className="text-sm font-medium text-foreground mb-2">
            {editingPackId ? "Edit Hint Pack (YAML)" : "Add Hint Pack (YAML)"}
          </h3>
          <textarea
            value={yamlInput}
            onChange={(e) => setYamlInput(e.target.value)}
            placeholder={`name: "My Hint Pack"\nhints:\n  - name: "Helper Lemma"\n    descriptions:\n      - "Brief hint description"\n      - "More detailed explanation"\n    force_find: "theorem my_theorem[\\\\s\\\\S]*?(?=\\\\n\\\\n|$)"\n    code_completions:\n      - find: "theorem my_theorem.*?sorry"\n        replace: "theorem my_theorem ... := by\\n  tactic1"`}
            className="w-full h-52 px-3 py-2 bg-surface border border-border rounded text-sm font-mono text-foreground placeholder:text-muted/50 resize-y"
            spellCheck={false}
          />
          {submitError && (
            <p className="text-xs text-red-500 mt-1">{submitError}</p>
          )}
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSubmitHintPack}
              disabled={submitting || !yamlInput.trim()}
              className="px-3 py-1.5 bg-accent text-white text-sm rounded hover:bg-accent/90 transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Saving..." : editingPackId ? "Update" : "Submit"}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setYamlInput(""); setEditingPackId(null); setSubmitError(null); }}
              className="px-3 py-1.5 bg-badge text-muted text-sm rounded hover:text-foreground transition cursor-pointer"
            >
              Cancel
            </button>
            {editingPackId && (
              <button
                onClick={() => handleDeletePack(editingPackId)}
                className="px-3 py-1.5 bg-red-500/10 text-red-500 text-sm rounded hover:bg-red-500/20 transition cursor-pointer ml-auto"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// HintPackContent: renders expanded hints as flat list of steps
// ============================================

function HintPackContent({ hints }: { hints: ParsedHint[] }) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [editorCode, setEditorCode] = useState("");

  // Listen for code changes from editor - shared across all hints
  useEffect(() => {
    const handleCodeChange = (e: Event) => {
      const code = (e as CustomEvent).detail?.code;
      if (typeof code === "string") setEditorCode(code);
    };

    window.addEventListener("leetlean:code-updated", handleCodeChange);
    window.dispatchEvent(new CustomEvent("leetlean:request-code"));
    return () => window.removeEventListener("leetlean:code-updated", handleCodeChange);
  }, []);

  const toggleStep = (key: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Flatten all steps across all hints, tracking hint boundaries for separators
  const allSteps: { hint: ParsedHint; hintIndex: number; step: ParsedHintStep; stepIndex: number; globalIndex: number; isFirstOfHint: boolean }[] = [];
  let globalIdx = 0;
  for (let hi = 0; hi < hints.length; hi++) {
    for (let si = 0; si < hints[hi].steps.length; si++) {
      allSteps.push({
        hint: hints[hi],
        hintIndex: hi,
        step: hints[hi].steps[si],
        stepIndex: si,
        globalIndex: globalIdx,
        isFirstOfHint: si === 0 && hi > 0,
      });
      globalIdx++;
    }
  }

  // Compute global completion index offset for each hint
  // (for passing to CodeCompletionButtons)
  const hintCompletionOffsets: number[] = [];
  let offset = 0;
  for (const hint of hints) {
    hintCompletionOffsets.push(offset);
    for (const step of hint.steps) {
      offset += step.code_completions.length;
    }
  }

  return (
    <div className="space-y-0">
      {allSteps.map(({ hint, hintIndex, step, stepIndex, globalIndex, isFirstOfHint }) => {
        const key = `${hintIndex}-${stepIndex}`;
        const isExpanded = expandedSteps.has(key);

        return (
          <div key={key}>
            {/* Separator between hints */}
            {isFirstOfHint && (
              <div className="border-t border-border my-2" />
            )}

            {/* Step collapser */}
            <button
              onClick={() => toggleStep(key)}
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-hover/50 transition-colors cursor-pointer rounded"
            >
              <svg
                className={`h-3.5 w-3.5 text-muted transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              <span className="text-sm text-muted text-foreground">{step.name}</span>
            </button>

            {/* Expanded step content */}
            {isExpanded && (
              <div className="pl-3 pr-3 pb-2 space-y-3">
                {step.description && (
                  <div className="text-xs text-foreground break-words overflow-hidden comment-markdown">
                    <MarkdownRenderer content={step.description} />
                  </div>
                )}

                {step.code_completions.length > 0 && (
                  <StepCompletionButtons
                    hint={hint}
                    step={step}
                    hintIndex={hintIndex}
                    stepIndex={stepIndex}
                    hintCompletionOffset={hintCompletionOffsets[hintIndex]}
                    editorCode={editorCode}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// StepCompletionButtons: buttons for a single step's code completions
// ============================================

function StepCompletionButtons({
  hint,
  step,
  hintIndex,
  stepIndex,
  hintCompletionOffset,
  editorCode,
}: {
  hint: ParsedHint;
  step: ParsedHintStep;
  hintIndex: number;
  stepIndex: number;
  hintCompletionOffset: number;
  editorCode: string;
}) {
  // Calculate the global completion index for this step's completions within the hint
  let localOffset = 0;
  for (let i = 0; i < stepIndex; i++) {
    localOffset += hint.steps[i].code_completions.length;
  }

  const handleApply = (completionIdx: number) => {
    const globalIdx = localOffset + completionIdx;
    const statuses = getStepStatuses(editorCode, hint);
    const status = statuses[globalIdx];

    if (status === "applied") return;

    let newCode: string | null = null;
    if (status === "ready") {
      // Apply all preceding ready steps first, then this one
      let code = editorCode;
      const allCompletions = getAllCompletions(hint);
      for (let i = 0; i <= globalIdx; i++) {
        const st = getStepStatuses(code, hint);
        if (st[i] === "ready") {
          const applied = applyStep(code, allCompletions[i]);
          if (applied !== null) code = applied;
          else break;
        } else if (st[i] === "applied") {
          continue;
        } else {
          break;
        }
      }
      newCode = code !== editorCode ? code : null;
    } else {
      // Force apply
      newCode = forceApplyStep(editorCode, hint, globalIdx);
    }

    if (newCode !== null) {
      window.dispatchEvent(
        new CustomEvent("leetlean:apply-hint-code", { detail: { code: newCode } })
      );
    }
  };

  const statuses = getStepStatuses(editorCode, hint);

  return (
    <div className="flex flex-wrap py-2 gap-1.5">
      {step.code_completions.map((completion, i) => {
        const globalIdx = localOffset + i;
        const status = statuses[globalIdx];

        const classes = {
          applied: "bg-green-500/10 text-green-600 border border-green-500/30 cursor-default",
          ready: "bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30 cursor-pointer",
          force: "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border border-orange-500/30 cursor-pointer",
        };

        const label = completion.name || `Step ${globalIdx + 1}`;
        const displayLabel = status === "applied" ? `${label} ✓` : status === "force" ? `${label} (force)` : label;

        return (
          <button
            key={i}
            onClick={() => handleApply(i)}
            disabled={status === "applied"}
            className={`px-2.5 py-1 text-xs rounded transition ${classes[status]}`}
            title={status === "applied" ? "Already applied" : status === "ready" ? `Apply: ${label}` : `Force apply: ${label}`}
          >
            {displayLabel}
          </button>
        );
      })}
    </div>
  );
}
