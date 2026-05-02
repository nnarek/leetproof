export type Difficulty = "easy" | "medium" | "hard";
export type SubmissionStatus = "pending" | "accepted" | "wrong";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  starter_code: string;
  main_theorem_name: string | null;
  theorem_type: string | null;
  allowed_axioms: string[] | null;
  tags: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  user_id: string;
  problem_id: string;
  code: string;
  status: SubmissionStatus;
  name: string | null;
  notes: string | null;
  errors: string | null;
  submitted_at: string;
}

export interface Solution {
  id: string;
  user_id: string;
  problem_id: string;
  submission_id: string;
  title: string;
  content: string;
  is_public: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SolutionWithMeta extends Solution {
  like_count: number;
  user_has_liked: boolean;
  profiles: { full_name: string | null; avatar_url: string | null; email: string | null };
  submissions: { code: string; status: SubmissionStatus };
}

// For the problems list page (joined with user submission status)
export interface ProblemListItem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  sort_order: number;
  user_status?: SubmissionStatus | null;
}

export interface SolutionComment {
  id: string;
  solution_id: string;
  user_id: string;
  parent_id: string | null;
  replied_to_comment_id: string | null;
  reply_to_user_id: string | null;
  content: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommentWithMeta extends SolutionComment {
  like_count: number;
  user_has_liked: boolean;
  profiles: { full_name: string | null; avatar_url: string | null; email: string | null };
  reply_to_username: string | null;
  replies: CommentWithMeta[];
}

// ============================================
// Hint Packs
// ============================================

export interface HintPack {
  id: string;
  user_id: string;
  problem_id: string;
  yaml_content: string;
  created_at: string;
  updated_at: string;
}

export interface HintPackWithMeta extends HintPack {
  like_count: number;
  user_has_liked: boolean;
  profiles: { full_name: string | null; avatar_url: string | null; email: string | null };
  parsed?: ParsedHintPack;
}

// Parsed YAML structure
export interface ParsedHintPack {
  name?: string;
  hints: ParsedHint[];
}

export interface ParsedHint {
  name?: string;
  force_find: string;
  steps: ParsedHintStep[];
}

export interface ParsedHintStep {
  name: string;
  description?: string;
  code_completions: HintCodeCompletion[];
}

export interface HintCodeCompletion {
  name?: string;
  find: string;
  replace: string;
}
