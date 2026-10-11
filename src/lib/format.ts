import { getParamSpec, PLUGINS, type ParamSpec } from "@/audio/paramSchema";
import type { Mapping } from "@/mapping/types";

export function formatParam(spec: Pick<ParamSpec, "unit">, value: number): string {
  if (spec.unit === "Hz" && value < 20) return `${value.toFixed(2)} Hz`;
  if (spec.unit === "Hz") return value >= 1000 ? `${(value / 1000).toFixed(1)} kHz` : `${Math.round(value)} Hz`;
  if (spec.unit === "s") return `${value.toFixed(2)} s`;
  if (spec.unit === "dB") return `${Math.round(value)} dB`;
  if (spec.unit === "oct") return `${value.toFixed(1)} oct`;
  return value.toFixed(2);
}

export const GESTURE_LABEL = { pinch_left: "Left Pinch", pinch_right: "Right Pinch" } as const;

/** A plain-English description of a hand-picked mapping, for the Live Mapping summary line. */
export function summarizeMapping(mapping: Mapping): string {
  if (mapping.mappings.length === 0) return "Nothing bound yet.";
  return mapping.mappings
    .map((m) => {
      const names = m.targets.map((t) => {
        const spec = getParamSpec(t.plugin, t.param);
        const plugin = PLUGINS.find((p) => p.id === t.plugin)?.label ?? t.plugin;
        return spec ? `${plugin} ${spec.label}` : `${t.plugin}.${t.param}`;
      });
      return `${GESTURE_LABEL[m.gesture]}: ${names.join(", ")}.`;
    })
    .join(" ");
}
