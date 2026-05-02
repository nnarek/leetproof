-- ============================================
-- Verification Enhancement Migration
-- Adds theorem_type and allowed_axioms to problems
-- Idempotent: safe to run multiple times
-- ============================================

-- theorem_type: the Lean type signature to verify (e.g. "(α : Type) → (xs : List α) → xs.reverse.reverse = xs")
DO $$ BEGIN
  ALTER TABLE public.problems ADD COLUMN theorem_type text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- allowed_axioms: list of axiom names allowed for this problem
DO $$ BEGIN
  ALTER TABLE public.problems ADD COLUMN allowed_axioms text[] DEFAULT '{propext,Quot.sound,Classical.choice}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
