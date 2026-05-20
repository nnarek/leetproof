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
  theorem implies_trans (P Q R : Prop) (hpq : P → Q) (hqr : Q → R) : P → R := by
    sorry
---



Prove that implication is transitive: if `P → Q` and `Q → R`, then `P → R`.

### Background

Implication (`→`) in Lean 4 corresponds to function types. A proof of `P → Q` is literally a function that takes a proof of `P` and returns a proof of `Q`. Transitivity of implication is just function composition!
