---
slug: "list-max-append"
title: "List Max Append"
difficulty: "easy"
tags: ["list"]
sort_order: 16
verifier_code: |
  import Lean

  {{SOLUTION}}

  #check (max?_append : ∀ {α} [Max α] [Std.Associative (max : α → α → α)] (l₁ l₂ : List α), (l₁ ++ l₂).max? = max l₁.max? l₂.max?)

  #eval show Lean.Meta.MetaM Unit from do
    let thmName := ``max?_append
    let used ← Lean.collectAxioms thmName
    if used.contains ``sorryAx then
      throwError m!"'{thmName}' proof uses sorry"
    let allowedNames := [``propext, ``Classical.choice, ``Quot.sound]
    let disallowed := used.filter (fun ax => !allowedNames.contains ax)
    if !disallowed.isEmpty then
      throwError m!"'{thmName}' theorem uses disallowed axioms: {disallowed.toList}"
starter_code: |

  theorem max?_append [Max α] [Std.Associative (max : α → α → α)] (l₁ l₂ : List α) :
      (l₁ ++ l₂).max? = max l₁.max? l₂.max? := by
    sorry
---

Prove that the maximum element of a concatenated list equals the maximum of the two individual list maximums.

Given two lists `l₁` and `l₂`, show that `(l₁ ++ l₂).max? = max l₁.max? l₂.max?`.

Note: `List.max?` returns `none` for an empty list and `some x` for the maximum element `x`. The `max` on the right-hand side operates on `Option α` values.
