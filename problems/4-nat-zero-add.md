---
slug: "nat-zero-add"
title: "Natural Number: 0 + n = n"
difficulty: "easy"
tags: ["natural-numbers", "induction", "arithmetic"]
sort_order: 4
main_theorem_name: "zero_add"
theorem_type: "(n : Nat) \u2192 0 + n = n"
allowed_axioms: []
starter_code: |
  theorem zero_add (n : Nat) : 0 + n = n := by
    sorry
---
 


Prove that for any natural number `n`, we have `0 + n = n`.

### Background

In Lean 4's definition of natural numbers, addition is defined recursively on the **second** argument:
- `0 + n = n` (by definition)
- `(m + 1) + n = (m + n) + 1`

Since `0 + n = n` holds by the definitional unfolding of `+`, this should be provable just by reflexivity.

### Note

This is a fundamental lemma that appears in every formalization of arithmetic. In Mathlib, it's called `Nat.zero_add`.
