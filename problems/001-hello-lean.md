---
slug: "hello-lean"
title: "Hello, Lean!"
difficulty: "easy"
tags: ["basics", "introduction"]
sort_order: 1
main_theorem_name: "hello_lean"
theorem_type: "True"
allowed_axioms: []
starter_code: |
  -- Welcome to LeetLean!
  -- Your goal: make this file compile with no errors.
  -- Replace `sorry` with a valid proof.

  theorem hello_lean : True := by
    sorry
---

 
Welcome to your first LeetLean problem! This is a warmup to make sure you can use the editor.

### Goal

Prove that `True` holds. This is the simplest possible theorem in Lean 4.

### Hints

- The tactic `trivial` can close goals that are obviously true.
- Alternatively, you can use the term-mode proof `True.intro`.
- `sorry` is a placeholder that makes the proof compile but marks it as incomplete. **Replace it!**

### Background

In Lean 4, `True` is a proposition that is trivially provable. It has exactly one constructor: `True.intro`. This problem gets you comfortable with the basic structure of a theorem statement and proof.

```lean
-- Example: two ways to prove True
theorem example1 : True := True.intro
theorem example2 : True := by trivial
```
