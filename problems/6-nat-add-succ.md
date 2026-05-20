---
slug: "nat-add-succ"
title: "Natural Number: m + (n + 1) = (m + n) + 1"
difficulty: "easy"
tags: ["natural-numbers", "arithmetic"]
sort_order: 6
main_theorem_name: "add_succ"
theorem_type: "(m n : Nat) \u2192 m + n.succ = (m + n).succ"
allowed_axioms: []
starter_code: |
  theorem add_succ (m n : Nat) : m + n.succ = (m + n).succ := by
    sorry
---


Prove that for all natural numbers `m` and `n`, we have `m + n.succ = (m + n).succ`.
