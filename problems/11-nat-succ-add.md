---
slug: "nat-succ-add"
title: "Natural Number: (m + 1) + n = (m + n) + 1"
difficulty: "easy"
tags: ["natural-numbers", "induction", "arithmetic"]
sort_order: 11
main_theorem_name: "succ_add"
theorem_type: "(m n : Nat) \u2192 m.succ + n = (m + n).succ"
allowed_axioms: []
starter_code: |
  theorem succ_add (m n : Nat) : m.succ + n = (m + n).succ := by
    sorry
---


Prove that for all natural numbers `m` and `n`, we have `m.succ + n = (m + n).succ`.

### Background

This theorem establishes the relationship between the successor function and addition. It shows that adding a natural number to the successor of another is equivalent to taking the successor of their sum. This is a fundamental lemma often used in proving properties of natural numbers.
