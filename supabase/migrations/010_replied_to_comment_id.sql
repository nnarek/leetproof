-- Add replied_to_comment_id to track the exact comment a user clicked "Reply" on.
-- parent_id stores the thread root; replied_to_comment_id stores the actual target.
ALTER TABLE public.solution_comments
  ADD COLUMN replied_to_comment_id uuid REFERENCES public.solution_comments(id) ON DELETE SET NULL;
