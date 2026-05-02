---
slug: "de-morgan"
title: "De Morgan's Law"
difficulty: "medium"
tags: ["logic", "negation", "classical"]
sort_order: 7
main_theorem_name: "de_morgan"
theorem_type: "(P Q : Prop) \u2192 \u00AC(P \u2228 Q) \u2192 \u00ACP \u2227 \u00ACQ"
allowed_axioms: ['propext'] # TODO simple proof does not require any additional axiom, so consider to make this list empty
starter_code: |
  -- Prove one direction of De Morgan's Law.
  -- ¬(P ∨ Q) → ¬P ∧ ¬Q

  theorem de_morgan (P Q : Prop) : ¬(P ∨ Q) → ¬P ∧ ¬Q := by
    sorry
---
 
### Goal

Prove that `¬(P ∨ Q) → ¬P ∧ ¬Q`.

This is one direction of De Morgan's Law. Note that this direction is provable constructively (no need for classical logic).

### Background

De Morgan's Laws relate negation with conjunction and disjunction:
- `¬(P ∨ Q) ↔ ¬P ∧ ¬Q`
- `¬(P ∧ Q) ↔ ¬P ∨ ¬Q` (the `←` direction requires classical logic)

Remember that `¬P` is defined as `P → False` in Lean 4.

### Hints

1. `intro h` to get `h : ¬(P ∨ Q)`, i.e., `h : P ∨ Q → False`.
2. `constructor` to split the `∧` goal into `¬P` and `¬Q`.
3. For each part, introduce the hypothesis and derive `False` by applying `h` to an appropriate `Or` term.

### Key Insight

Since `¬P` means `P → False`, to prove `¬P` you just `intro hp` and then show `False`. You can get `False` from `h` by feeding it `Or.inl hp`.
