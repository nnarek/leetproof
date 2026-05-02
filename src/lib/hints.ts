import yaml from "js-yaml";
import type { ParsedHintPack, ParsedHint, ParsedHintStep, HintCodeCompletion } from "@/lib/types";

/**
 * Parse a YAML string into a ParsedHintPack structure.
 * Supports both the new step-based format and legacy descriptions/code_completions format.
 * Returns null if parsing fails.
 */
export function parseHintPackYaml(yamlContent: string): ParsedHintPack | null {
  try {
    const raw = yaml.load(yamlContent) as any;
    if (!raw || !Array.isArray(raw.hints)) return null;

    const hints: ParsedHint[] = raw.hints.map((h: any) => {
      const force_find = typeof h.force_find === "string" ? h.force_find : "";

      // New format: steps array
      if (Array.isArray(h.steps)) {
        const steps: ParsedHintStep[] = h.steps.map((s: any) => ({
          name: typeof s.name === "string" ? s.name : "Step",
          description: typeof s.description === "string" ? s.description : undefined,
          code_completions: Array.isArray(s.code_completions)
            ? s.code_completions.map((cc: any): HintCodeCompletion => ({
                name: typeof cc.name === "string" ? cc.name : undefined,
                find: typeof cc.find === "string" ? cc.find : "",
                replace: typeof cc.replace === "string" ? cc.replace : "",
              }))
            : [],
        }));
        return { name: typeof h.name === "string" ? h.name : undefined, force_find, steps };
      }

      // Legacy format: descriptions + code_completions → convert to steps
      const descriptions: string[] = Array.isArray(h.descriptions) ? h.descriptions.map(String) : [];
      const legacyCompletions: HintCodeCompletion[] = Array.isArray(h.code_completions)
        ? h.code_completions.map((cc: any): HintCodeCompletion => ({
            name: typeof cc.name === "string" ? cc.name : undefined,
            find: typeof cc.find === "string" ? cc.find : "",
            replace: typeof cc.replace === "string" ? cc.replace : "",
          }))
        : [];

      // Convert legacy: each description becomes a step, code_completions go on the last step
      const steps: ParsedHintStep[] = [];
      if (descriptions.length > 0) {
        for (let i = 0; i < descriptions.length; i++) {
          steps.push({
            name: `Step ${i + 1}`,
            description: descriptions[i],
            code_completions: i === descriptions.length - 1 ? legacyCompletions : [],
          });
        }
      } else if (legacyCompletions.length > 0) {
        steps.push({
          name: "Code",
          description: undefined,
          code_completions: legacyCompletions,
        });
      }

      return { name: typeof h.name === "string" ? h.name : undefined, force_find, steps };
    });

    return {
      name: typeof raw.name === "string" ? raw.name : undefined,
      hints,
    };
  } catch {
    return null;
  }
}

/**
 * Get all code completions from a hint, flattened across all steps.
 */
export function getAllCompletions(hint: ParsedHint): HintCodeCompletion[] {
  return hint.steps.flatMap((s) => s.code_completions);
}

/**
 * Find the current completion step for a hint by checking which regex matches.
 * Uses binary-search-like approach: checks from the last step backwards.
 * Returns the index of the NEXT step to apply (0 means no steps applied yet).
 * Returns -1 if code is in an unrecognized state (force replace needed).
 */
export function findCurrentStep(code: string, hint: ParsedHint): number {
  const completions = getAllCompletions(hint);
  if (completions.length === 0) return 0;

  // Check from last step backwards - if the last step's output is present,
  // all previous steps were completed
  for (let i = completions.length - 1; i >= 0; i--) {
    try {
      // Check if step i's replace text is present (meaning step i was applied)
      // We use the find regex of step i+1 if available, or check if the replace content exists
      if (i < completions.length - 1) {
        const nextFind = new RegExp(completions[i + 1].find, "s");
        if (nextFind.test(code)) return i + 1;
      } else {
        // Last step - check if its replace text is literally in the code
        const lastReplace = completions[i].replace.trim();
        if (code.includes(lastReplace)) return completions.length; // all done
      }
    } catch {
      // Invalid regex, skip
    }
  }

  // Check if the first step can be applied (initial state)
  try {
    const firstFind = new RegExp(completions[0].find, "s");
    if (firstFind.test(code)) return 0;
  } catch {
    // Invalid regex
  }

  // Code doesn't match any known state
  return -1;
}

/**
 * Check if a specific code completion step can be applied to the current code.
 */
export function canApplyStep(code: string, step: HintCodeCompletion): boolean {
  try {
    const regex = new RegExp(step.find, "s");
    return regex.test(code);
  } catch {
    return false;
  }
}

/**
 * Check if a step's output is already present in the code (step already applied).
 * We check if the replace text (trimmed) is contained in the code.
 * This means the step was previously applied and the code hasn't changed.
 */
export function isStepApplied(code: string, step: HintCodeCompletion): boolean {
  const replaced = step.replace.trim();
  if (!replaced) return false;
  return code.includes(replaced);
}

/**
 * Determine the status of each code completion step in a hint.
 * Returns array of statuses corresponding to each step.
 * Logic:
 * - If step N is applied (its replace is in code), all steps <= N are "applied".
 * - If step N is "ready" (find matches), all subsequent steps are also "ready"
 *   because applying N would make N+1 ready, etc.
 * - Otherwise "force".
 */
export function getStepStatuses(
  code: string,
  hint: ParsedHint
): ("applied" | "ready" | "force")[] {
  const steps = getAllCompletions(hint);
  if (steps.length === 0) return [];

  // Find the highest step whose replace text is in the code
  let highestApplied = -1;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (isStepApplied(code, steps[i])) {
      highestApplied = i;
      break;
    }
  }

  // Find the first step that is "ready" (after applied ones)
  let firstReady = -1;
  for (let i = highestApplied + 1; i < steps.length; i++) {
    if (canApplyStep(code, steps[i])) {
      firstReady = i;
      break;
    }
  }

  return steps.map((_step, i) => {
    if (i <= highestApplied) return "applied";
    // If a step at or before i is ready, this step is also ready
    // (because applying prior steps would make this one ready)
    if (firstReady !== -1 && i >= firstReady) return "ready";
    return "force";
  });
}

/**
 * Determine the status of a code completion step:
 * - "applied": The step's output is already in the code (green)
 * - "ready": The step's find regex matches - can be applied (blue/accent)
 * - "force": Neither matches - needs force apply (orange)
 */
export function getStepStatus(
  code: string,
  step: HintCodeCompletion
): "applied" | "ready" | "force" {
  if (isStepApplied(code, step)) return "applied";
  if (canApplyStep(code, step)) return "ready";
  return "force";
}

/**
 * Apply a code completion step to the current code.
 * Returns the new code, or null if the regex didn't match.
 */
export function applyStep(code: string, step: HintCodeCompletion): string | null {
  try {
    const regex = new RegExp(step.find, "s");
    if (!regex.test(code)) return null;
    return code.replace(regex, step.replace);
  } catch {
    return null;
  }
}

/**
 * Force-apply a code completion step by using the force_find regex.
 * This replaces the entire matched section with the step's replace text.
 * If stepIndex > 0, it applies step 0's replace first (via force_find),
 * then sequentially applies steps 1..stepIndex.
 */
export function forceApplyStep(
  code: string,
  hint: ParsedHint,
  stepIndex: number
): string | null {
  try {
    const completions = getAllCompletions(hint);
    const forceRegex = new RegExp(hint.force_find, "s");
    if (!forceRegex.test(code)) return null;

    // Replace with the first step's replacement
    let result = code.replace(forceRegex, completions[0].replace);

    // Sequentially apply steps 1 through stepIndex
    for (let i = 1; i <= stepIndex; i++) {
      const applied = applyStep(result, completions[i]);
      if (applied === null) return null;
      result = applied;
    }

    return result;
  } catch {
    return null;
  }
}
