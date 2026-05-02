"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import type { Submission } from "@/lib/types";
import MarkdownRenderer from "@/components/MarkdownRenderer";

const LeanCodeBlock = dynamic(() => import("@/components/LeanCodeBlock"), { ssr: false });

interface SubmissionViewProps {
  submission: Submission;
  problemId: string;
  onBack: () => void;
  onDeleted: () => void;
  onUpdated: (updated: Submission) => void;
}

export default function SubmissionView({
  submission: sub,
  problemId,
  onBack,
  onDeleted,
  onUpdated,
}: SubmissionViewProps) {
  const { user } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(sub.name || "");
  const [notes, setNotes] = useState(sub.notes || "");
  const [notesEditing, setNotesEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const isOwner = user?.id === sub.user_id;

  const handleRenameSave = async () => {
    if (nameValue === (sub.name || "")) { setEditingName(false); return; }
    const supabase = createClient();
    const { error } = await supabase
      .from("submissions")
      .update({ name: nameValue || null })
      .eq("id", sub.id);
    if (!error) {
      onUpdated({ ...sub, name: nameValue || null });
    }
    setEditingName(false);
  };

  const handleNotesSave = async () => {
    if (notes === (sub.notes || "")) { setNotesEditing(false); return; }
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("submissions")
      .update({ notes: notes || null })
      .eq("id", sub.id);
    if (error) {
      setSaveError(error.message);
    } else {
      onUpdated({ ...sub, notes: notes || null });
      setNotesEditing(false);
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!user) return;
    setPublishing(true);
    setPublishError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("solutions")
      .insert({
        user_id: user.id,
        problem_id: problemId,
        submission_id: sub.id,
        title: sub.name || "Untitled Solution",
        content: sub.notes || "",
        is_public: false,
        tags: [],
      })
      .select("id")
      .single();
    if (error) {
      setPublishError(error.message);
      setPublishing(false);
      return;
    }
    // Navigate to the solution view
    const pathParts = window.location.pathname.split("/");
    const slug = pathParts[pathParts.indexOf("problems") + 1];
    const url = new URL(window.location.href);
    url.pathname = `/problems/${slug}/solutions`;
    url.searchParams.set("id", data.id);
    window.location.href = url.toString();
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this submission? This cannot be undone.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("submissions").delete().eq("id", sub.id);
    if (!error) {
      onDeleted();
    }
  };

  const handleLoadIntoEditor = () => {
    if (!window.confirm("Load this submission's code into the editor? Your current code will be replaced.")) return;
    window.dispatchEvent(new CustomEvent("leetlean:load-code", { detail: { code: sub.code } }));
    onBack();
  };

  const statusBadgeClass =
    sub.status === "accepted"
      ? "badge-success"
      : sub.status === "wrong"
        ? "badge-danger"
        : "badge-warning";

  return (
    <div className="space-y-3 pt-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="vscode-menu-btn"
        >
          &larr; Submissions
        </button>
        <div className="flex items-center gap-2">
          {sub.status === "accepted" && isOwner && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="vscode-menu-btn"
              style={{ background: '#0078d4', color: '#fff' }}
            >
              {publishing ? "Publishing..." : "Publish"}
            </button>
          )}
          {isOwner && (
            <button
              onClick={handleLoadIntoEditor}
              className="vscode-menu-btn"
              title="Load this code into the editor"
            >
              Load in Editor
            </button>
          )}
          {isOwner && (
            <button
              onClick={handleDelete}
              className="vscode-menu-btn"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Header: name + status + date */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${statusBadgeClass}`}
        >
          {sub.status}
        </span>
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSave();
                if (e.key === "Escape") { setEditingName(false); setNameValue(sub.name || ""); }
              }}
              className="rounded border border-border bg-background px-2 py-0.5 text-sm text-foreground w-48 focus:border-accent focus:outline-none"
              autoFocus
              placeholder="Submission name"
            />
            <button
              onClick={handleRenameSave}
              disabled={nameValue === (sub.name || "")}
              className="vscode-menu-btn disabled:opacity-50"
              style={nameValue !== (sub.name || "") ? { background: '#0078d4', color: '#fff' } : undefined}
            >
              Save
            </button>
            <button
              onClick={() => { setEditingName(false); setNameValue(sub.name || ""); }}
              className="vscode-menu-btn"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditingName(true);
              setNameValue(sub.name || "");
            }}
            className="text-sm font-semibold text-foreground hover:text-accent transition-colors"
            title="Click to rename"
          >
            {sub.name || "Unnamed submission"}
          </button>
        )}
        <span className="text-xs text-muted ml-auto">
          {new Date(sub.submitted_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Code */}
      <LeanCodeBlock code={sub.code} />

      {/* Errors (for wrong submissions) */}
      {sub.status === "wrong" && sub.errors && (
        <div className="rounded-md border border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] p-3 overflow-x-auto">
          <p className="text-[10px] text-[var(--badge-danger-text)] mb-2 uppercase tracking-wider">
            Errors
          </p>
          <pre className="text-xs text-[var(--badge-danger-text)] font-mono whitespace-pre-wrap leading-relaxed">
            {sub.errors}
          </pre>
        </div>
      )}

      {/* Publish error */}
      {publishError && (
        <p className="text-xs text-[var(--badge-danger-text)]">Publish failed: {publishError}</p>
      )}

      {/* Notes */}
      {isOwner && (
        <div>
          <p className="text-xs font-medium text-foreground mb-3 text-muted">Notes</p>
          {notesEditing ? (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none min-h-[100px] resize-y font-mono"
                placeholder="Add notes about this submission (Markdown supported)..."
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleNotesSave}
                  disabled={saving || notes === (sub.notes || "")}
                  className="vscode-menu-btn disabled:opacity-50"
                  style={!saving && notes !== (sub.notes || "") ? { background: '#0078d4', color: '#fff' } : undefined}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => {
                    setNotesEditing(false);
                    setNotes(sub.notes || "");
                    setSaveError(null);
                  }}
                  className="vscode-menu-btn"
                >
                  Cancel
                </button>
              </div>
              {saveError && (
                <p className="text-xs text-[var(--badge-danger-text)]">Error: {saveError}</p>
              )}
            </div>
          ) : sub.notes ? (
            <div
              onClick={() => setNotesEditing(true)}
              className="rounded-md border border-border bg-surface/50 p-3 cursor-pointer hover:border-accent/50 transition-colors overflow-hidden break-words"
              title="Click to edit notes"
            >
              <MarkdownRenderer content={sub.notes} />
            </div>
          ) : (
            <div
              onClick={() => setNotesEditing(true)}
              className="rounded-md border border-dashed border-border bg-surface/50 p-3 cursor-pointer hover:border-accent/50 transition-colors"
              title="Click to add notes"
            >
              <p className="text-sm text-muted/60 italic">Click to leave notes...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
