"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import type { CommentWithMeta } from "@/lib/types";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface CommentsSectionProps {
  solutionId: string;
}

const REPLIES_INITIAL = 3;

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CommentsSection({ solutionId }: CommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; commentId: string; username: string; userId: string } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const fetchComments = useCallback(async () => {
    const supabase = createClient();

    const { data: commentsData } = await supabase
      .from("solution_comments")
      .select("*")
      .eq("solution_id", solutionId)
      .order("created_at", { ascending: true });

    if (!commentsData || commentsData.length === 0) {
      setComments([]);
      setLoading(false);
      return;
    }

    // Fetch profiles
    const userIds = [...new Set(commentsData.map((c: any) => c.user_id))];
    const replyToIds = commentsData.map((c: any) => c.reply_to_user_id).filter(Boolean);
    const allUserIds = [...new Set([...userIds, ...replyToIds])];

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .in("id", allUserIds);

    const profilesMap: Record<string, { full_name: string | null; avatar_url: string | null; email: string | null }> = {};
    for (const p of profilesData || []) {
      profilesMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url, email: p.email };
    }

    // Fetch likes
    const commentIds = commentsData.map((c: any) => c.id);
    const { data: likesData } = await supabase
      .from("comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", commentIds);

    const likeCounts: Record<string, number> = {};
    const userLikes = new Set<string>();
    for (const like of likesData || []) {
      likeCounts[like.comment_id] = (likeCounts[like.comment_id] || 0) + 1;
      if (user && like.user_id === user.id) {
        userLikes.add(like.comment_id);
      }
    }

    // Build tree
    const enriched: CommentWithMeta[] = commentsData.map((c: any) => {
      const replyToProfile = c.reply_to_user_id ? profilesMap[c.reply_to_user_id] : null;
      return {
        ...c,
        like_count: likeCounts[c.id] || 0,
        user_has_liked: userLikes.has(c.id),
        profiles: profilesMap[c.user_id] || { full_name: null, avatar_url: null, email: null },
        reply_to_username: replyToProfile?.email?.split("@")[0] || null,
        replies: [],
      };
    });

    // Group: top-level comments have parent_id = null
    const topLevel: CommentWithMeta[] = [];
    const repliesMap: Record<string, CommentWithMeta[]> = {};

    for (const c of enriched) {
      if (!c.parent_id) {
        topLevel.push(c);
      } else {
        if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
        repliesMap[c.parent_id].push(c);
      }
    }

    for (const c of topLevel) {
      c.replies = repliesMap[c.id] || [];
    }

    setComments(topLevel);
    setLoading(false);
  }, [solutionId, user]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handlePost = async () => {
    if (!user || !newComment.trim()) return;
    setPosting(true);
    const supabase = createClient();
    await supabase.from("solution_comments").insert({
      solution_id: solutionId,
      user_id: user.id,
      content: newComment.trim(),
    });
    setNewComment("");
    setPosting(false);
    fetchComments();
  };

  const handleReply = async (parentId: string, replyToUserId: string | null, repliedToCommentId: string | null) => {
    if (!user || !replyText.trim()) return;
    const supabase = createClient();
    await supabase.from("solution_comments").insert({
      solution_id: solutionId,
      user_id: user.id,
      parent_id: parentId,
      reply_to_user_id: replyToUserId,
      replied_to_comment_id: repliedToCommentId,
      content: replyText.trim(),
    });
    setReplyText("");
    setReplyingTo(null);
    fetchComments();
  };

  const handleEdit = async (commentId: string) => {
    if (!editText.trim()) return;
    const supabase = createClient();
    await supabase
      .from("solution_comments")
      .update({ content: editText.trim(), is_edited: true, updated_at: new Date().toISOString() })
      .eq("id", commentId);
    setEditingId(null);
    setEditText("");
    fetchComments();
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    const supabase = createClient();
    // Check if comment has replies
    const comment = findComment(commentId);
    if (comment && !comment.parent_id) {
      // Top-level: check if has replies
      if (comment.replies.length > 0) {
        // Soft delete: replace content
        await supabase
          .from("solution_comments")
          .update({ content: "[deleted]", is_edited: false })
          .eq("id", commentId);
      } else {
        await supabase.from("solution_comments").delete().eq("id", commentId);
      }
    } else {
      // Reply: check if other replies reference this user
      await supabase.from("solution_comments").delete().eq("id", commentId);
    }
    fetchComments();
  };

  const handleLike = async (commentId: string) => {
    if (!user) return;
    const supabase = createClient();
    const comment = findComment(commentId);
    if (!comment) return;
    // Prevent self-liking
    if (comment.user_id === user.id) return;

    if (comment.user_has_liked) {
      await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", user.id);
    } else {
      await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: user.id });
    }

    // Optimistic update
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          return { ...c, like_count: c.user_has_liked ? c.like_count - 1 : c.like_count + 1, user_has_liked: !c.user_has_liked };
        }
        return {
          ...c,
          replies: c.replies.map((r) =>
            r.id === commentId
              ? { ...r, like_count: r.user_has_liked ? r.like_count - 1 : r.like_count + 1, user_has_liked: !r.user_has_liked }
              : r
          ),
        };
      })
    );
  };

  const findComment = (id: string): CommentWithMeta | undefined => {
    for (const c of comments) {
      if (c.id === id) return c;
      const reply = c.replies.find((r) => r.id === id);
      if (reply) return reply;
    }
    return undefined;
  };

  const toggleExpand = (parentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const totalCount = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);

  const isDeleted = (comment: CommentWithMeta) => comment.content === "[deleted]";

  const renderComment = (comment: CommentWithMeta, isReply = false, parentId?: string) => {
    const username = comment.profiles.email?.split("@")[0] || "anonymous";
    const isCommentOwner = user?.id === comment.user_id;
    const deleted = isDeleted(comment);

    return (
      <div key={comment.id} className={`${isReply ? "ml-6 border-l border-border pl-3" : ""}`}>
        <div className="py-2">
          {/* Header */}
          <div className="flex items-center gap-2">
            {!deleted && (
              <>
                {comment.profiles.avatar_url ? (
                  <img src={comment.profiles.avatar_url} alt="" className="h-5 w-5 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-badge border border-border flex items-center justify-center">
                    <span className="text-[9px] text-muted">{username[0]?.toUpperCase()}</span>
                  </div>
                )}
                <span className="text-xs font-medium text-foreground">{username}</span>
              </>
            )}
            <span className="text-[10px] text-muted">{timeAgo(comment.is_edited ? comment.updated_at : comment.created_at)}</span>
            {comment.is_edited && !deleted && (
              <span className="text-[10px] text-muted italic">(edited)</span>
            )}
          </div>

          {/* Content */}
          {deleted ? (
            <p className="text-sm text-muted/50 italic mt-1">[comment deleted]</p>
          ) : editingId === comment.id ? (
            <div className="mt-1 space-y-1">
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
                value={editText}
                onChange={(e) => {
                  setEditText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  const maxH = window.innerHeight * 0.66;
                  el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
                  el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
                }}
                className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none resize-none"
                rows={Math.max(3, (editText || "").split("\n").length)}
                autoFocus
              />
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(comment.id)}
                  disabled={!editText.trim() || editText.trim() === comment.content}
                  className="vscode-menu-btn disabled:opacity-50"
                  style={editText.trim() && editText.trim() !== comment.content ? { background: '#0078d4', color: '#fff' } : undefined}
                >
                  Save
                </button>
                <button onClick={() => setEditingId(null)} className="vscode-menu-btn">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="mt-0.5 text-xs text-foreground break-words overflow-hidden comment-markdown">
              {comment.reply_to_username && (
                <span className="text-accent text-[0.82rem]">@{comment.reply_to_username} </span>
              )}
              <MarkdownRenderer content={comment.content} />
            </div>
          )}

          {/* Actions */}
          {!deleted && editingId !== comment.id && (
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => handleLike(comment.id)}
                disabled={!user}
                className={`flex items-center gap-0.5 text-[11px] ${comment.user_has_liked ? "text-accent" : "text-muted"} ${user ? "hover:text-accent" : "opacity-50"}`}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                {comment.like_count > 0 && comment.like_count}
              </button>
              {user && (
                <button
                  onClick={() => {
                    setReplyingTo({ id: parentId || comment.id, commentId: comment.id, username, userId: comment.user_id });
                    setReplyText("");
                  }}
                  className="text-[11px] text-muted hover:text-foreground"
                >
                  Reply
                </button>
              )}
              {isCommentOwner && (
                <>
                  <button
                    onClick={() => { setEditingId(comment.id); setEditText(comment.content); }}
                    className="text-[11px] text-muted hover:text-foreground"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-[11px] text-muted hover:text-foreground"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <p className="text-xs text-muted mt-4">Loading comments...</p>;
  }

  return (
    <div className="mt-5 ">
      <p className="text-xs font-medium text-foreground mb-3 text-muted">
        Comments{totalCount > 0 && ` (${totalCount})`}
      </p>

      {/* New comment input */}
      {user ? (
        <div className="space-y-2 mb-4">
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
            value={newComment}
            onChange={(e) => {
              setNewComment(e.target.value);
              const el = e.target;
              el.style.height = 'auto';
              const maxH = window.innerHeight * 0.66;
              el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
              el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none resize-none"
            placeholder="Write a comment (Markdown supported)..."
            rows={3}
          />
          <button
            onClick={handlePost}
            disabled={posting || !newComment.trim()}
            className="vscode-menu-btn disabled:opacity-50"
            style={!posting && newComment.trim() ? { background: '#0078d4', color: '#fff' } : undefined}
          >
            {posting ? "Posting..." : "Comment"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted mb-4">Sign in to comment.</p>
      )}

      {/* Comments list */}
      {comments.length === 0 && (
        <p className="text-xs text-muted">No comments yet.</p>
      )}

      {comments.map((comment) => {
        const visibleReplies = expandedReplies.has(comment.id)
          ? comment.replies
          : comment.replies.slice(0, REPLIES_INITIAL);
        const hiddenCount = comment.replies.length - REPLIES_INITIAL;

        return (
          <div key={comment.id}>
            {renderComment(comment, false)}

            {/* Replies */}
            {visibleReplies.map((reply) => renderComment(reply, true, comment.id))}

            {/* Show more button */}
            {hiddenCount > 0 && !expandedReplies.has(comment.id) && (
              <button
                onClick={() => toggleExpand(comment.id)}
                className="ml-6 text-[11px] text-accent hover:underline mt-1"
              >
                Show {hiddenCount} more {hiddenCount === 1 ? "reply" : "replies"}
              </button>
            )}
            {expandedReplies.has(comment.id) && comment.replies.length > REPLIES_INITIAL && (
              <button
                onClick={() => toggleExpand(comment.id)}
                className="ml-6 text-[11px] text-accent hover:underline mt-1"
              >
                Show less
              </button>
            )}

            {/* Reply input */}
            {replyingTo && replyingTo.id === comment.id && (
              <div className="ml-6 mt-2 space-y-1">
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
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    const el = e.target;
                    el.style.height = 'auto';
                    const maxH = window.innerHeight * 0.66;
                    el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
                    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
                  }}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none resize-none"
                  placeholder={`Reply to @${replyingTo.username}...`}
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => handleReply(comment.id, replyingTo.userId, replyingTo.commentId)}
                    disabled={!replyText.trim()}
                    className="vscode-menu-btn disabled:opacity-50"
                    style={replyText.trim() ? { background: '#0078d4', color: '#fff' } : undefined}
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="vscode-menu-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
