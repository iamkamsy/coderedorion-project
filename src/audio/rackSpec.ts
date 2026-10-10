import { PARAM_SPECS, clampToSchema, paramKey, type PluginId } from "./paramSchema";

/** Effect modules in signal order (like a pedalboard). A rack always chains them in this order. */
export const EFFECT_ORDER = ["distortion", "phaser", "filter", "delay", "reverb"] as const satisfies readonly PluginId[];

export type EffectId = (typeof EFFECT_ORDER)[number];

/** The full studio at `/` loads every effect. */
export const STUDIO_MODULES: readonly EffectId[] = EFFECT_ORDER;

/** Effects the studio starts bypassed, so the first sound is clean. Approving a mapping that targets one enables it. */
export const STUDIO_BYPASSED: readonly EffectId[] = ["distortion", "phaser"];

export function isEffectId(id: string): id is EffectId {
  return (EFFECT_ORDER as readonly string[]).includes(id);
}

/** Dedupe, drop unknown ids, and sort into signal order. */
export function orderModules(ids: readonly string[]): EffectId[] {
  const wanted = new Set(ids);
  return EFFECT_ORDER.filter((id) => wanted.has(id));
}

/** Plugins a rack with these modules exposes: the input stage plus each effect. */
export function rackPlugins(modules: readonly EffectId[]): PluginId[] {
  return ["input", ...orderModules(modules)];
}

/** Default values for every parameter of a rack built from these modules. */
export function defaultValuesFor(modules: readonly EffectId[]): Record<string, number> {
  const plugins = new Set<string>(rackPlugins(modules));
  return Object.fromEntries(PARAM_SPECS.filter((s) => plugins.has(s.plugin)).map((s) => [paramKey(s.plugin, s.param), s.default]));
}

/** Note divisions the delay can lock to, in beats. A dot adds half the note's length. */
export const DIVISIONS = {
  "4n": { label: "1/4", beats: 1 },
  "4n.": { label: "1/4.", beats: 1.5 },
  "8n": { label: "1/8", beats: 0.5 },
  "8n.": { label: "1/8.", beats: 0.75 },
  "16n": { label: "1/16", beats: 0.25 },
} as const;

export type Division = keyof typeof DIVISIONS;

export function isDivision(value: string): value is Division {
  return value in DIVISIONS;
}

/** Delay time for a division at a tempo, clamped to the delay's safe range. */
export function divisionSeconds(division: Division, bpm: number): number {
  return clampToSchema("delay", "delayTime", (DIVISIONS[division].beats * 60) / bpm);
}
