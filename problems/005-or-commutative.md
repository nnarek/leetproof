---
slug: "or-commutative"
title: "Or is Commutative"
difficulty: "medium"
tags: ["logic", "or", "tactics"]
sort_order: 5
main_theorem_name: "or_comm_proof"
theorem_type: "(P Q : Prop) \u2192 P \u2228 Q \u2192 Q \u2228 P"
allowed_axioms: []
starter_code: |
  -- Prove that disjunction is commutative.

  theorem or_comm_proof (P Q : Prop) : P ∨ Q → Q ∨ P := by
    sorry
---
 
### Goal

Prove that disjunction (logical OR) is commutative: `P ∨ Q → Q ∨ P`.

### Background

A proof of `P ∨ Q` is either a proof of `P` (left injection) or a proof of `Q` (right injection). To prove commutativity, you need to case-split on which side holds and inject it into the opposite side.

### Hints

- Use `intro h` to get `h : P ∨ Q`.
- Use `cases h with` (or `rcases h with hp | hq`) to split into cases.
- In the `P` case, use `Or.inr` (or `right`); in the `Q` case, use `Or.inl` (or `left`).

### Tactics Reference

| Tactic | Effect |
|--------|--------|
| `intro h` | Introduce hypothesis |
| `cases h with` | Case split on disjunction |
| `left` | Prove left side of `∨` |
| `right` | Prove right side of `∨` |
| `exact` | Provide exact proof term |
