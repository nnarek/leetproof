---
slug: "double-neg-elim"
title: "Double Negation Elimination"
difficulty: "easy"
tags: ["logic", "classical", "tactics"]
sort_order: 9
main_theorem_name: "not_not"
theorem_type: "(P : Prop) \u2192 \u00AC\u00ACP \u2192 P"
allowed_axioms: ['propext', 'Classical.choice', 'Quot.sound']
starter_code: |
  theorem not_not (P : Prop) : ¬¬P → P := by
    sorry
---



Prove **double negation elimination**: `¬¬P → P`.

This requires classical logic — it is not provable constructively.

### Background

In constructive logic (the default in Lean 4), `¬¬P → P` is **not** provable. However, with the classical axiom `em : ∀ (P : Prop), P ∨ ¬P` (law of excluded middle), we can prove it.

The `Classical` namespace provides:
- `Classical.em (P : Prop) : P ∨ ¬P`
- `Classical.byContradiction : (¬P → False) → P`

