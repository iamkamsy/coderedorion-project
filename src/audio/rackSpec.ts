import { PARAM_SPECS, paramKey, type PluginId } from "./paramSchema";

/** Effect modules in signal order. A rack always chains them in this order. */
export const EFFECT_ORDER = ["filter", "delay", "reverb"] as const satisfies readonly PluginId[];

export type EffectId = (typeof EFFECT_ORDER)[number];

/** The full studio at `/` loads every effect. */
export const STUDIO_MODULES: readonly EffectId[] = EFFECT_ORDER;

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
