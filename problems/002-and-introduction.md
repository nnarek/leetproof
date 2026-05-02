---
slug: "and-introduction"
title: "And Introduction"
difficulty: "easy"
tags: ["logic", "and", "tactics"]
sort_order: 2
main_theorem_name: "and_intro"
theorem_type: "(p : Prop) \u2192 (q : Prop) \u2192 p \u2192 q \u2192 p \u2227 q"
allowed_axioms: []
starter_code: |
  -- Prove that if P and Q are both true, then P ∧ Q is true.

  theorem and_intro (p : Prop) (q : Prop) (hp : p) (hq : q) : p ∧ q := by
    sorry
---

### Goal

Given propositions `P` and `Q`, and proofs `hp : P` and `hq : Q`, prove `P ∧ Q`.

### Background

The conjunction `P ∧ Q` (read "P and Q") is true when both `P` and `Q` are true. In Lean 4, you construct a proof of `P ∧ Q` by providing proofs of both `P` and `Q`.

### Hints

- The `constructor` tactic splits an `∧` goal into two sub-goals.
- The `exact` tactic can close a goal if you provide exactly the right proof term.
- You can also use `And.intro hp hq` in term mode.
- The `⟨hp, hq⟩` anonymous constructor syntax also works.

### Reference

```lean
-- Example
theorem example_and : 1 = 1 ∧ 2 = 2 := by
  constructor
  · rfl
  · rfl
```
