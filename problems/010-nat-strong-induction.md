---
slug: "nat-strong-induction"
title: "Strong Induction Principle"
difficulty: "hard"
tags: ["natural-numbers", "induction", "advanced"]
sort_order: 10
main_theorem_name: "strong_induction"
theorem_type: "(P : Nat \u2192 Prop) \u2192 (\u2200 n, (\u2200 m, m < n \u2192 P m) \u2192 P n) \u2192 \u2200 n, P n"
allowed_axioms: ['propext', 'Classical.choice', 'Quot.sound']
starter_code: |
  -- Prove that every natural number has a property P,
  -- given that P holds for n whenever it holds for all m < n.
  -- This is the strong (or complete) induction principle.

  theorem strong_induction
    (P : Nat → Prop)
    (h : ∀ n, (∀ m, m < n → P m) → P n)
    : ∀ n, P n := by
    sorry
---

### Goal

Prove the **strong induction** (also called **complete induction**) principle for natural numbers:

If for every `n`, `P n` holds whenever `P m` holds for all `m < n`, then `P n` holds for all `n`.

$$\left(\forall n,\; (\forall m < n,\; P(m)) \Rightarrow P(n)\right) \Rightarrow \forall n,\; P(n)$$

### Background

Ordinary induction proves `P n` by assuming `P (n-1)`. Strong induction is more powerful: to prove `P n`, you may assume `P m` for **all** `m < n`. This is particularly useful for proofs where you need to "look back" more than one step.

### Hints

- The key insight is to prove a stronger statement first: `∀ n, ∀ m, m < n → P m`.
- Do induction on `n` for this stronger statement.
- Base case: vacuously true (no `m < 0`).
- Inductive step: given the IH for `n`, prove for `n + 1`. For `m < n + 1`, either `m < n` (use IH) or `m = n` (use hypothesis `h`).
- The `omega` tactic helps with the arithmetic reasoning.

### This is Hard

This problem tests your understanding of both induction and how to strengthen induction hypotheses — a crucial proof technique in formal verification.
