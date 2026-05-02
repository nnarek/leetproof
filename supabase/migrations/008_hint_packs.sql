-- ============================================
-- Hint Packs Migration
-- Adds hint packs system for problems
-- Idempotent: safe to run multiple times
-- ============================================

-- Hint packs table: stores YAML-based hint definitions
CREATE TABLE IF NOT EXISTS public.hint_packs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  problem_id uuid REFERENCES public.problems(id) ON DELETE CASCADE NOT NULL,
  yaml_content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Hint pack likes: one like per user per hint pack
CREATE TABLE IF NOT EXISTS public.hint_pack_likes (
  hint_pack_id uuid REFERENCES public.hint_packs(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (hint_pack_id, user_id)
);

-- ============================================
-- RLS: hint_packs
-- ============================================
ALTER TABLE public.hint_packs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Hint packs viewable by everyone"
    ON public.hint_packs FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own hint packs"
    ON public.hint_packs FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own hint packs"
    ON public.hint_packs FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own hint packs"
    ON public.hint_packs FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- RLS: hint_pack_likes
-- ============================================
ALTER TABLE public.hint_pack_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Hint pack likes viewable by everyone"
    ON public.hint_pack_likes FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own hint pack likes"
    ON public.hint_pack_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own hint pack likes"
    ON public.hint_pack_likes FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hint_packs_problem_id ON public.hint_packs(problem_id);
CREATE INDEX IF NOT EXISTS idx_hint_pack_likes_hint_pack_id ON public.hint_pack_likes(hint_pack_id);
