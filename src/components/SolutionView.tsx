"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import type { SolutionWithMeta } from "@/lib/types";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import CommentsSection from "@/components/CommentsSection";

const LeanCodeBlock = dynamic(() => import("@/components/LeanCodeBlock"), { ssr: false });

interface SolutionViewProps {
  solution: SolutionWithMeta;
  onBack: () => void;
  onLike: () => void;
  onUpdated: () => void;
}

export default function SolutionView({ solution: sol, onBack, onLike, onUpdated }: SolutionViewProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(sol.is_public);
  const isOwner = user?.id === sol.user_id;
  const username = sol.profiles.email?.split("@")[0] || "anonymous";

  // Local display state (for immediate UI updates after save)
  const [displayTitle, setDisplayTitle] = useState(sol.title || "");
  const [displayContent, setDisplayContent] = useState(sol.content || "");
  const [displayTags, setDisplayTags] = useState(sol.tags);

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(sol.title || "");

  // Inline notes editing
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesValue, setNotesValue] = useState(sol.content || "");
  const [notesSaving, setNotesSaving] = useState(false);

  // Tags editing
  const [editingTags, setEditingTags] = useState(false);
  const [tagsInput, setTagsInput] = useState(sol.tags.join(", "));

  const handleTitleSave = async () => {
    if (titleValue === displayTitle) { setEditingTitle(false); return; }
    const supabase = createClient();
    const { error } = await supabase
      .from("solutions")
      .update({ title: titleValue || null, updated_at: new Date().toISOString() })
      .eq("id", sol.id);
    if (!error) {
      setDisplayTitle(titleValue);
      onUpdated();
    }
    setEditingTitle(false);
  };

  const handleNotesSave = async () => {
    if (notesValue === displayContent) { setNotesEditing(false); return; }
    setNotesSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("solutions")
      .update({ content: notesValue || "", updated_at: new Date().toISOString() })
      .eq("id", sol.id);
    if (!error) {
      setDisplayContent(notesValue);
      setNotesEditing(false);
      onUpdated();
    }
    setNotesSaving(false);
  };

  const handleTagsSave = async () => {
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const supabase = createClient();
    const { error } = await supabase
      .from("solutions")
      .update({ tags, updated_at: new Date().toISOString() })
      .eq("id", sol.id);
    if (!error) {
      setDisplayTags(tags);
      onUpdated();
    }
    setEditingTags(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this solution? This cannot be undone.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("solutions").delete().eq("id", sol.id);
    if (!error) onBack();
  };

  const handleToggleVisibility = async () => {
    const supabase = createClient();
    const newPublic = !isPublic;
    const { error } = await supabase
      .from("solutions")
      .update({ is_public: newPublic })
      .eq("id", sol.id);
    if (!error) {
      setIsPublic(newPublic);
      onUpdated();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-3">
      {/* Top bar: back + upvote + actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="vscode-menu-btn"
        >
          &larr; Solutions
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onLike}
            disabled={!user}
            className={`vscode-menu-btn ${
              sol.user_has_liked
                ? "!text-accent !bg-accent/10"
                : ""
            } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
            title={user ? (sol.user_has_liked ? "Remove upvote" : "Upvote") : "Sign in to upvote"}
          >
            <svg className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            {sol.like_count}
          </button>
          <button
            onClick={handleCopyLink}
            className="vscode-menu-btn"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
          {isOwner && (
            <>
              <button
                onClick={handleToggleVisibility}
                className="vscode-menu-btn"
              >
                {isPublic ? "Make Private" : "Make Public"}
              </button>
              <button
                onClick={handleDelete}
                className="vscode-menu-btn"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      {isOwner && editingTitle ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave();
              if (e.key === "Escape") { setEditingTitle(false); setTitleValue(displayTitle); }
            }}
            className="rounded border border-border bg-background px-2 py-0.5 text-sm font-semibold text-foreground flex-1 focus:border-accent focus:outline-none"
            autoFocus
            placeholder="Solution title"
          />
          <button
            onClick={handleTitleSave}
            disabled={titleValue === displayTitle}
            className="vscode-menu-btn disabled:opacity-50"
            style={titleValue !== displayTitle ? { background: '#0078d4', color: '#fff' } : undefined}
          >
            Save
          </button>
          <button
            onClick={() => { setEditingTitle(false); setTitleValue(displayTitle); }}
            className="vscode-menu-btn"
          >
            Cancel
          </button>
        </div>
      ) : isOwner ? (
        <button
          onClick={() => { setEditingTitle(true); setTitleValue(displayTitle); }}
          className="text-lg font-semibold text-foreground hover:text-accent transition-colors text-left"
          title="Click to rename"
        >
          {displayTitle || "Untitled Solution"}
        </button>
      ) : (
        <h2 className="text-lg font-semibold text-foreground">
          {displayTitle || "Untitled Solution"}
        </h2>
      )}

      {/* Author + meta */}
      <div className="flex items-center gap-2">
        {sol.profiles.avatar_url ? (
          <img src={sol.profiles.avatar_url} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="h-6 w-6 rounded-full bg-badge border border-border flex items-center justify-center">
            <span className="text-[10px] text-muted">{username[0]?.toUpperCase()}</span>
          </div>
        )}
        <span className="text-sm text-muted">
          {username}
        </span>
        {isOwner && (
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${
            isPublic ? "badge-success" : "badge-warning"
          }`}>
            {isPublic ? "Public" : "Private"}
          </span>
        )}
        <span className="text-xs text-muted ml-auto font-sans tabular-nums">
          {new Date(sol.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Tags */}
      {editingTags ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTagsSave();
              if (e.key === "Escape") { setEditingTags(false); setTagsInput(displayTags.join(", ")); }
            }}
            className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground flex-1 focus:border-accent focus:outline-none"
            autoFocus
            placeholder="e.g. induction, tactic-mode, elegant"
          />
          <button onClick={handleTagsSave} className="vscode-menu-btn" style={{ background: '#0078d4', color: '#fff' }}>Save</button>
          <button onClick={() => { setEditingTags(false); setTagsInput(displayTags.join(", ")); }} className="vscode-menu-btn">Cancel</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1 items-center">
          {displayTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md bg-badge px-2 py-0.5 text-xs text-muted"
            >
              {tag}
            </span>
          ))}
          {isOwner && (
            <button
              onClick={() => { setEditingTags(true); setTagsInput(displayTags.join(", ")); }}
              className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs text-muted hover:text-accent transition-colors"
              title="Edit tags"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Code */}
      {sol.submissions.code ? (
        <LeanCodeBlock code={sol.submissions.code} />
      ) : (
        <div className="rounded-md border border-border bg-surface/50 p-4 text-center">
          <p className="text-sm text-muted">Sign in to view the proof code.</p>
        </div>
      )}

      {/* Notes */}
      {isOwner ? (
        <div>
          <p className="text-xs font-medium text-foreground mb-3 text-muted ">Notes</p>
          {notesEditing ? (
            <div className="space-y-2">
              <textarea
                ref={(el) => {
                  if (el) {
                    requestAnimationFrame(() => {
                      el.style.height = 'auto';
                      const maxH = window.innerHeight * 0.66;
                      el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
                      el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
                    });
                  }
                }}
                value={notesValue}
                onChange={(e) => {
                  setNotesValue(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  const maxH = window.innerHeight * 0.66;
                  el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
                  el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none resize-none font-mono"
                placeholder="Add notes about your solution (Markdown supported)..."
                rows={Math.max(4, (notesValue || "").split("\n").length)}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleNotesSave}
                  disabled={notesSaving || notesValue === displayContent}
                  className="vscode-menu-btn disabled:opacity-50"
                  style={!notesSaving && notesValue !== displayContent ? { background: '#0078d4', color: '#fff' } : undefined}
                >
                  {notesSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => { setNotesEditing(false); setNotesValue(displayContent); }}
                  className="vscode-menu-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : displayContent ? (
            <div
              onClick={() => setNotesEditing(true)}
              className="rounded-md border border-border bg-surface/50 p-3 cursor-pointer hover:border-accent/50 transition-colors overflow-hidden break-words"
              title="Click to edit notes"
            >
              <MarkdownRenderer content={displayContent} />
            </div>
          ) : (
            <div
              onClick={() => setNotesEditing(true)}
              className="rounded-md border border-dashed border-border bg-surface/50 p-3 cursor-pointer hover:border-accent/50 transition-colors"
              title="Click to add notes"
            >
              <p className="text-sm text-muted/60 italic">Click to add notes...</p>
            </div>
          )}
        </div>
      ) : displayContent ? (
        <div>
          <p className="text-xs font-medium text-foreground mb-3 text-muted ">Notes</p>
          <div className="rounded-md border border-border bg-surface/50 p-3 overflow-hidden break-words">
            <MarkdownRenderer content={displayContent} />
          </div>
        </div>
      ) : null}

      {/* Comments */}
      <CommentsSection solutionId={sol.id} />
    </div>
  );
}
