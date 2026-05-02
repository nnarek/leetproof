---
slug: "implies-transitivity"
title: "Implies Transitivity"
difficulty: "easy"
tags: ["logic", "implication", "tactics"]
sort_order: 3
main_theorem_name: "implies_trans"
theorem_type: "(P Q R : Prop) \u2192 (P \u2192 Q) \u2192 (Q \u2192 R) \u2192 P \u2192 R"
allowed_axioms: []
starter_code: |
  -- Prove that implication is transitive.
  -- If P → Q and Q → R, then P → R.

  theorem implies_trans (P Q R : Prop) (hpq : P → Q) (hqr : Q → R) : P → R := by
    sorry
---

### Goal

Prove that implication is transitive: if `P → Q` and `Q → R`, then `P → R`.

### Background

Implication (`→`) in Lean 4 corresponds to function types. A proof of `P → Q` is literally a function that takes a proof of `P` and returns a proof of `Q`. Transitivity of implication is just function composition!

### Hints

- Use `intro hp` to assume `P` and get a proof `hp : P`.
- Then use `apply hqr` to reduce the goal to proving `Q`.
- Then use `apply hpq` to reduce the goal to proving `P`.
- Finally `exact hp` closes the goal.

### Alternative Approaches

```lean
-- Term-mode proof (function composition)
theorem implies_trans_v2 (P Q R : Prop) (hpq : P → Q) (hqr : Q → R) : P → R :=
  fun hp => hqr (hpq hp)
```
