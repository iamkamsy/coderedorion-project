import { clampToSchema, getParamSpec, isMappable, paramKey } from "@/audio/paramSchema";
import { MappingSchema, type Mapping } from "./types";

export type ValidationResult = { ok: true; mapping: Mapping } | { ok: false; error: string };

/**
 * Validate untrusted mapping JSON (for example Gemini output). Rejects unknown
 * or non-mappable plugins and params, duplicate gestures and duplicate targets, and clamps every
 * min and max into the parameter's hard safe range. min may exceed max, which
 * inverts the gesture direction.
 */
export function validateMapping(input: unknown): ValidationResult {
  const parsed = MappingSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Invalid mapping at ${issue.path.join(".") || "root"}: ${issue.message}` };
  }

  const seenGestures = new Set<string>();
  for (const m of parsed.data.mappings) {
    if (seenGestures.has(m.gesture)) return { ok: false, error: `Gesture ${m.gesture} is mapped twice` };
    seenGestures.add(m.gesture);

    const seenTargets = new Set<string>();
    for (const t of m.targets) {
      const key = paramKey(t.plugin, t.param);
      const spec = getParamSpec(t.plugin, t.param);
      if (!spec) return { ok: false, error: `Unknown parameter ${key}` };
      if (!isMappable(spec)) return { ok: false, error: `Parameter ${key} cannot be mapped to a gesture` };
      if (seenTargets.has(key)) return { ok: false, error: `Parameter ${key} is targeted twice by ${m.gesture}` };
      seenTargets.add(key);
    }
  }

  const mapping: Mapping = {
    mappings: parsed.data.mappings.map((m) => ({
      gesture: m.gesture,
      targets: m.targets.map((t) => ({
        ...t,
        min: clampToSchema(t.plugin, t.param, t.min),
        max: clampToSchema(t.plugin, t.param, t.max),
      })),
    })),
  };
  return { ok: true, mapping };
}
