---
slug: "nat-add-comm"
title: "Addition is Commutative"
difficulty: "easy"
tags: ["natural-numbers", "induction", "arithmetic"]
sort_order: 12
main_theorem_name: "add_comm"
theorem_type: "(m n : Nat) \u2192 m + n = n + m"
allowed_axioms: []
starter_code: |
  theorem add_comm (m n : Nat) : m + n = n + m := by
    sorry
---


Prove that for all natural numbers `m` and `n`, we have `m + n = n + m`.

### Background

This is a classic theorem that requires proof by induction. Since addition is defined by recursion on the second argument, you typically do induction on one of the arguments and use previously established lemmas.
