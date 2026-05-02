---
slug: "nat-add-zero"
title: "Natural Number: n + 0 = n"
difficulty: "easy"
tags: ["natural-numbers", "induction", "arithmetic"]
sort_order: 4
main_theorem_name: "add_zero_right"
theorem_type: "(n : Nat) \u2192 n + 0 = n"
allowed_axioms: ['propext']
starter_code: |
  -- Prove that adding zero on the right gives back the same number.

  theorem add_zero_right (n : Nat) : n + 0 = n := by
    sorry
---
 
### Goal

Prove that for any natural number `n`, we have `n + 0 = n`.

### Background

In Lean 4's definition of natural numbers, addition is defined recursively on the **second** argument:
- `n + 0 = n` (by definition)
- `n + (m + 1) = (n + m) + 1`

Since `n + 0 = n` holds by the definitional unfolding of `+`, this should be provable just by reflexivity.

### Hints

- Try `rfl` — it works when both sides are definitionally equal.
- If `rfl` doesn't work in your Lean version, try `simp` or `omega`.

### Note

This is a fundamental lemma that appears in every formalization of arithmetic. In Mathlib, it's called `Nat.add_zero`.
