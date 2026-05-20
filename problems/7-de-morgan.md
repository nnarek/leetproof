---
slug: "de-morgan"
title: "De Morgan's Law"
difficulty: "easy"
tags: ["logic", "negation"]
sort_order: 7
main_theorem_name: "de_morgan"
theorem_type: "(P Q : Prop) \u2192 \u00AC(P \u2228 Q) \u2192 \u00ACP \u2227 \u00ACQ"
allowed_axioms: ['propext'] # TODO simple proof does not require any additional axiom, so consider to make this list empty
starter_code: |
  theorem de_morgan (P Q : Prop) : ¬(P ∨ Q) → ¬P ∧ ¬Q := by
    sorry
---
 


Prove that `¬(P ∨ Q) → ¬P ∧ ¬Q`.

This is one direction of De Morgan's Law. Note that this direction is provable constructively (no need for classical logic).

### Background

De Morgan's Laws relate negation with conjunction and disjunction:
- `¬(P ∨ Q) ↔ ¬P ∧ ¬Q`
- `¬(P ∧ Q) ↔ ¬P ∨ ¬Q` (the `←` direction requires classical logic)

