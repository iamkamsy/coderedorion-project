import { clampToSchema, paramKey } from "@/audio/paramSchema";
import type { Curve } from "@/audio/paramSchema";
import type { Gesture, GestureValues, Mapping } from "./types";

export interface ParamChange {
  plugin: string;
  param: string;
  value: number;
  /** null for manual slider moves. */
  gesture: Gesture | null;
}

/**
 * Scale a 0 to 1 gesture value between min and max.
 * - linear: straight interpolation
 * - exp: geometric interpolation when both ends are positive (right for Hz and seconds), else t squared
 * - log: fast start, slow finish
 */
export function scaleValue(t: number, min: number, max: number, curve: Curve): number {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  switch (curve) {
    case "linear":
      return min + (max - min) * x;
    case "exp":
      if (min > 0 && max > 0) return min * Math.pow(max / min, x);
      return min + (max - min) * x * x;
    case "log":
      return min + (max - min) * (1 - (1 - x) * (1 - x));
  }
}

/** Compute the clamped parameter values a mapping produces for the current gestures. */
export function computeChanges(mapping: Mapping, values: GestureValues): ParamChange[] {
  const changes: ParamChange[] = [];
  for (const m of mapping.mappings) {
    const v = values[m.gesture];
    if (v === null) continue;
    for (const t of m.targets) {
      const raw = scaleValue(v, t.min, t.max, t.curve);
      changes.push({ plugin: t.plugin, param: t.param, value: clampToSchema(t.plugin, t.param, raw), gesture: m.gesture });
    }
  }
  return changes;
}

/** Apply a mapping by calling setParam for every bound target. Returns the changes applied. */
export function applyMapping(
  mapping: Mapping,
  values: GestureValues,
  setParam: (plugin: string, param: string, value: number) => void,
): ParamChange[] {
  const changes = computeChanges(mapping, values);
  for (const c of changes) setParam(c.plugin, c.param, c.value);
  return changes;
}

/** Which gesture each bound parameter key is driven by. */
export function boundParams(mapping: Mapping): Map<string, Gesture> {
  const bound = new Map<string, Gesture>();
  for (const m of mapping.mappings) for (const t of m.targets) bound.set(paramKey(t.plugin, t.param), m.gesture);
  return bound;
}
