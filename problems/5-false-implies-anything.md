---
slug: "false-implies-anything"
title: "False Implies Anything"
difficulty: "easy"
tags: ["basics", "logic"]
sort_order: 5
main_theorem_name: "false_implies_anything"
theorem_type: "False → 1 = 2"
allowed_axioms: []
starter_code: |
  theorem false_implies_anything : False → 1 = 2 := by
    sorry
---


In classical logic, from `False` you can prove anything, even contradictions like `1 = 2`. This is known as the principle of explosion (ex falso quodlibet). 
