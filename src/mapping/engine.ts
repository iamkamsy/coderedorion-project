import { PARAM_SPECS, clampToSchema, getParamSpec, paramKey } from "@/audio/paramSchema";
import type { Curve } from "@/audio/paramSchema";
import { MAX_TARGETS_PER_GESTURE, type Gesture, type GestureValues, type Mapping } from "./types";

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

/**
 * Compute the clamped parameter values a mapping produces for the current gestures.
 * Locked parameter keys are skipped: they hold their value while the pinch moves.
 */
export function computeChanges(mapping: Mapping, values: GestureValues, locked: ReadonlySet<string> = new Set()): ParamChange[] {
  const changes: ParamChange[] = [];
  for (const m of mapping.mappings) {
    const v = values[m.gesture];
    if (v === null) continue;
    for (const t of m.targets) {
      if (locked.has(paramKey(t.plugin, t.param))) continue;
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
  locked?: ReadonlySet<string>,
): ParamChange[] {
  const changes = computeChanges(mapping, values, locked);
  for (const c of changes) setParam(c.plugin, c.param, c.value);
  return changes;
}

/** Which gesture each bound parameter key is driven by. */
export function boundParams(mapping: Mapping): Map<string, Gesture> {
  const bound = new Map<string, Gesture>();
  for (const m of mapping.mappings) for (const t of m.targets) bound.set(paramKey(t.plugin, t.param), m.gesture);
  return bound;
}

/** True when this gesture currently drives this parameter. */
export function isTargetBound(mapping: Mapping, gesture: Gesture, plugin: string, param: string): boolean {
  const gm = mapping.mappings.find((m) => m.gesture === gesture);
  return gm?.targets.some((t) => t.plugin === plugin && t.param === param) ?? false;
}

/**
 * Let a user hand-pick what a gesture controls: adds the target (at the parameter's full safe
 * range, so the picker never needs to know about curves or ranges) if it is not already bound to
 * this gesture, or removes it if it is. Returns null when the toggle is not possible: removing
 * the mapping's last remaining target (the contract requires at least one), or adding past
 * MAX_TARGETS_PER_GESTURE.
 */
export function toggleTarget(mapping: Mapping, gesture: Gesture, plugin: string, param: string): Mapping | null {
  const spec = getParamSpec(plugin, param);
  if (!spec) return null;

  const mappings = mapping.mappings.map((m) => ({ ...m, targets: [...m.targets] }));
  const gm = mappings.find((m) => m.gesture === gesture);
  const bound = gm?.targets.some((t) => t.plugin === plugin && t.param === param) ?? false;

  if (bound && gm) {
    gm.targets = gm.targets.filter((t) => !(t.plugin === plugin && t.param === param));
    if (gm.targets.length === 0) mappings.splice(mappings.indexOf(gm), 1);
  } else if (!bound) {
    const target = { plugin, param, min: spec.min, max: spec.max, curve: spec.curve };
    if (gm) {
      if (gm.targets.length >= MAX_TARGETS_PER_GESTURE) return null;
      gm.targets.push(target);
    } else {
      mappings.push({ gesture, targets: [target] });
    }
  }

  return mappings.length > 0 ? { mappings } : null;
}

/**
 * Turn a spoken lock request into parameter keys. Comma-separated refs: "pinch_right" or
 * "pinch_left" (everything that hand drives), "all" (everything any hand drives), or one param
 * by key ("phaser.frequency") or by its on-screen name ("phaser rate"), in any case. Refs that
 * match nothing come back in `unknown`.
 */
export function resolveParamRefs(refs: string, mapping: Mapping): { keys: string[]; unknown: string[] } {
  const keys = new Set<string>();
  const unknown: string[] = [];
  for (const ref of refs
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)) {
    const lower = ref.toLowerCase();
    if (lower === "all") {
      for (const k of boundParams(mapping).keys()) keys.add(k);
    } else if (lower === "pinch_right" || lower === "pinch_left") {
      for (const t of mapping.mappings.find((m) => m.gesture === lower)?.targets ?? []) keys.add(paramKey(t.plugin, t.param));
    } else {
      const spec = PARAM_SPECS.find(
        (s) => paramKey(s.plugin, s.param).toLowerCase() === lower || `${s.plugin} ${s.label}`.toLowerCase() === lower.replace(".", " "),
      );
      if (spec) keys.add(paramKey(spec.plugin, spec.param));
      else unknown.push(ref);
    }
  }
  return { keys: [...keys], unknown };
}
