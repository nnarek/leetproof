---
slug: "nat-add-comm"
title: "Addition is Commutative"
difficulty: "medium"
tags: ["natural-numbers", "induction", "arithmetic"]
sort_order: 6
main_theorem_name: "add_comm"
theorem_type: "(m n : Nat) \u2192 m + n = n + m"
allowed_axioms: ['propext']
starter_code: |
  -- Prove that addition of natural numbers is commutative.
  -- You will need induction and some helper lemmas.

  theorem add_comm (m n : Nat) : m + n = n + m := by
    sorry
---
### Goal

Prove that for all natural numbers `m` and `n`, we have `m + n = n + m`.

### Background

This is a classic theorem that requires proof by induction. Since addition is defined by recursion on the second argument, you typically do induction on one of the arguments and use previously established lemmas.

### Hints

- Use `induction n with` to do induction on `n`.
- **Base case** (`n = 0`): You need to show `m + 0 = 0 + m`. One side simplifies by definition.
- **Inductive step** (`n = k + 1`): You need to show `m + (k + 1) = (k + 1) + m`, using the inductive hypothesis `m + k = k + m`.
- You may need the lemma `Nat.succ_add : (n + 1) + m = (n + m) + 1`.
- The `omega` tactic can solve linear arithmetic goals automatically.

### Challenge

Try to prove it without using `omega` — using only `induction`, `rw`, `simp`, and basic lemmas!
