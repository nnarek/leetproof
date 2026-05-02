---
slug: "excluded-middle"
title: "Law of Excluded Middle (Application)"
difficulty: "hard"
tags: ["logic", "classical", "tactics"]
sort_order: 9
main_theorem_name: "double_neg_elim"
theorem_type: "(P : Prop) \u2192 \u00AC\u00ACP \u2192 P"
allowed_axioms: ['propext', 'Classical.choice', 'Quot.sound']
starter_code: |
  -- Using classical logic, prove double negation elimination.
  -- Hint: you can use `Classical.em` which gives `P ∨ ¬P`.

  open Classical in
  theorem double_neg_elim (P : Prop) : ¬¬P → P := by
    sorry
---

### Goal

Prove **double negation elimination**: `¬¬P → P`.

This requires classical logic — it is not provable constructively.

### Background

In constructive logic (the default in Lean 4), `¬¬P → P` is **not** provable. However, with the classical axiom `em : ∀ (P : Prop), P ∨ ¬P` (law of excluded middle), we can prove it.

The `Classical` namespace provides:
- `Classical.em (P : Prop) : P ∨ ¬P`
- `Classical.byContradiction : (¬P → False) → P`

### Hints

- Use `intro hnnp` to get `hnnp : ¬¬P`, i.e., `hnnp : ¬P → False`.
- Use `cases Classical.em P with` to split into `P` or `¬P`.
- If `P`, you're done. If `¬P`, apply `hnnp` to derive `False`, then use `contradiction` or `exact absurd hnp hnnp`.

### Alternative

```lean
open Classical in
theorem dne_v2 (P : Prop) : ¬¬P → P := by
  intro h
  byContradiction hn
  exact h hn
```
