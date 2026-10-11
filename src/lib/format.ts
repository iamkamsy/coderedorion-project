import type { ParamSpec } from "@/audio/paramSchema";

export function formatParam(spec: Pick<ParamSpec, "unit">, value: number): string {
  if (spec.unit === "Hz" && value < 20) return `${value.toFixed(2)} Hz`;
  if (spec.unit === "Hz") return value >= 1000 ? `${(value / 1000).toFixed(1)} kHz` : `${Math.round(value)} Hz`;
  if (spec.unit === "s") return `${value.toFixed(2)} s`;
  if (spec.unit === "dB") return `${Math.round(value)} dB`;
  if (spec.unit === "oct") return `${value.toFixed(1)} oct`;
  return value.toFixed(2);
}

export const GESTURE_LABEL = { pinch_left: "Left pinch", pinch_right: "Right pinch" } as const;
