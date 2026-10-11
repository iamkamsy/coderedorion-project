export type Curve = "linear" | "exp" | "log";

export interface ParamSpec {
  plugin: string;
  param: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  curve: Curve;
  /** Minimum time between applied changes. Used where a change is expensive. */
  throttleMs?: number;
  description: string;
}

/**
 * Single source of truth for every controllable parameter and its hard safe range.
 * The mapping engine and the rack clamp to these values regardless of what any
 * mapping (including Gemini output) asks for.
 */
export const PARAM_SPECS = [
  {
    plugin: "input",
    param: "lowCut",
    label: "Low cut",
    unit: "Hz",
    min: 20,
    max: 300,
    default: 100,
    curve: "exp",
    description: "High-pass on live input. Removes rumble and bass bleed from speakers in the room.",
  },
  {
    plugin: "input",
    param: "gateThreshold",
    label: "Gate",
    unit: "dB",
    min: -90,
    max: -20,
    // Fully open by default: an automatic gate chattered on held notes and phrase tails.
    default: -90,
    curve: "linear",
    description: "Noise gate on live input. Off at -90 dB. Raise it to mute signal quieter than this between phrases.",
  },
  {
    plugin: "distortion",
    param: "drive",
    label: "Drive",
    unit: "",
    min: 0,
    max: 0.9,
    default: 0.3,
    curve: "linear",
    throttleMs: 40,
    description: "How hard the signal is pushed into saturation. Low is warm, high is fuzzy and aggressive.",
  },
  {
    plugin: "distortion",
    param: "wet",
    label: "Mix",
    unit: "",
    min: 0,
    max: 1,
    default: 1,
    curve: "linear",
    description: "Blend of distorted and clean signal.",
  },
  {
    plugin: "phaser",
    param: "frequency",
    label: "Rate",
    unit: "Hz",
    min: 0.1,
    max: 8,
    default: 0.5,
    curve: "exp",
    description: "How fast the phaser sweeps. Slow is a gentle swirl, fast is a wobble.",
  },
  {
    plugin: "phaser",
    param: "octaves",
    label: "Depth",
    unit: "oct",
    min: 1,
    max: 6,
    default: 3,
    curve: "linear",
    throttleMs: 50,
    description: "How far the sweep travels. Deeper is a more dramatic whoosh.",
  },
  {
    plugin: "phaser",
    param: "wet",
    label: "Mix",
    unit: "",
    min: 0,
    max: 0.9,
    default: 0.5,
    curve: "linear",
    description: "Blend of phased and clean signal.",
  },
  {
    plugin: "reverb",
    param: "wet",
    label: "Mix",
    unit: "",
    min: 0,
    max: 0.9,
    default: 0.2,
    curve: "linear",
    description: "Reverb wet/dry mix. Higher is more spacious and washed out.",
  },
  {
    plugin: "reverb",
    param: "decay",
    label: "Decay",
    unit: "s",
    min: 0.5,
    max: 8,
    default: 2.5,
    curve: "exp",
    throttleMs: 400,
    description: "Reverb tail length in seconds. Longer is a bigger room.",
  },
  {
    plugin: "delay",
    param: "wet",
    label: "Mix",
    unit: "",
    min: 0,
    max: 0.9,
    default: 0.2,
    curve: "linear",
    description: "Echo wet/dry mix.",
  },
  {
    plugin: "delay",
    param: "feedback",
    label: "Feedback",
    unit: "",
    min: 0,
    max: 0.85,
    default: 0.3,
    curve: "linear",
    description: "How many times the echo repeats. Kept below 0.85 so it cannot run away.",
  },
  {
    plugin: "delay",
    param: "delayTime",
    label: "Time",
    unit: "s",
    min: 0.05,
    max: 1,
    default: 0.25,
    curve: "exp",
    description: "Time between echoes in seconds.",
  },
  {
    plugin: "filter",
    param: "frequency",
    label: "Cutoff",
    unit: "Hz",
    min: 100,
    max: 12000,
    default: 12000,
    curve: "exp",
    description: "Low-pass cutoff. Lower is darker and more muffled, higher is brighter.",
  },
  {
    plugin: "filter",
    param: "Q",
    label: "Resonance",
    unit: "",
    min: 0.5,
    max: 8,
    default: 1,
    curve: "linear",
    description: "Filter resonance around the cutoff. Higher is more nasal and peaky.",
  },
] as const satisfies readonly ParamSpec[];

export type PluginId = (typeof PARAM_SPECS)[number]["plugin"];
export type ParamKey = `${(typeof PARAM_SPECS)[number]["plugin"]}.${(typeof PARAM_SPECS)[number]["param"]}`;

export const PLUGINS: { id: PluginId; label: string }[] = [
  { id: "input", label: "Input" },
  { id: "distortion", label: "Distortion" },
  { id: "phaser", label: "Phaser" },
  { id: "filter", label: "Filter" },
  { id: "delay", label: "Delay" },
  { id: "reverb", label: "Reverb" },
];

const SPEC_BY_KEY = new Map<string, ParamSpec>(PARAM_SPECS.map((s) => [`${s.plugin}.${s.param}`, s]));

export function paramKey(plugin: string, param: string): string {
  return `${plugin}.${param}`;
}

export function getParamSpec(plugin: string, param: string): ParamSpec | undefined {
  return SPEC_BY_KEY.get(paramKey(plugin, param));
}

export function specsForPlugin(plugin: PluginId): ParamSpec[] {
  return PARAM_SPECS.filter((s) => s.plugin === plugin);
}

/** Clamp a value to the parameter's hard safe range. Throws for unknown parameters. */
export function clampToSchema(plugin: string, param: string, value: number): number {
  const spec = getParamSpec(plugin, param);
  if (!spec) throw new Error(`Unknown parameter ${paramKey(plugin, param)}`);
  if (!Number.isFinite(value)) return spec.default;
  return Math.min(spec.max, Math.max(spec.min, value));
}
