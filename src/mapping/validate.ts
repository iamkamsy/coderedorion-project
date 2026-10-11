import { clampToSchema, getParamSpec, paramKey } from "@/audio/paramSchema";
import { MappingSchema, type Mapping } from "./types";

export type ValidationResult = { ok: true; mapping: Mapping } | { ok: false; error: string };

export interface ValidateOptions {
  /** Only allow targets on these effects (the ones loaded in the current rack). The input stage is always allowed. */
  plugins?: readonly string[];
}

/**
 * Validate untrusted mapping JSON (for example Gemini output). Rejects unknown
 * plugins and params, duplicate gestures and duplicate targets, and clamps every
 * min and max into the parameter's hard safe range. min may exceed max, which
 * inverts the gesture direction. With `plugins`, also rejects targets on effects that
 * are not loaded, so a tutorial's rack cannot be driven outside its own effects.
 */
export function validateMapping(input: unknown, options: ValidateOptions = {}): ValidationResult {
  // Every rack has the input stage (low cut and gate), so its params are always allowed.
  const allowed = options.plugins ? new Set(["input", ...options.plugins]) : null;
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
      if (allowed && !allowed.has(t.plugin)) return { ok: false, error: `${t.plugin} is not loaded in this rack` };
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
