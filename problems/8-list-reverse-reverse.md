---
slug: "list-reverse-reverse"
title: "List Reverse Reverse"
difficulty: "medium"
tags: ["lists", "induction", "program-verification"]
sort_order: 8
main_theorem_name: "reverse_reverse"
theorem_type: "(\u03B1 : Type) \u2192 (xs : List \u03B1) \u2192 xs.reverse.reverse = xs"
allowed_axioms: ['propext','Classical.choice','Quot.sound']
starter_code: |
  theorem reverse_reverse (α : Type) (xs : List α) : xs.reverse.reverse = xs := by
    sorry
---



Prove that reversing a list twice yields the original list:

 $$\hspace{2em} \text{reverse}(\text{reverse}(xs)) = xs$$

### Background

List reverse is defined recursively:
- `[].reverse = []`
- `(x :: xs).reverse = xs.reverse ++ [x]`

Proving `reverse (reverse xs) = xs` requires induction on the list and a key helper lemma about how reverse distributes over append.
