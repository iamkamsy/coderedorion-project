import { z } from "zod";

export const GESTURES = ["pinch_left", "pinch_right"] as const;
export const CURVES = ["linear", "exp", "log"] as const;

export const MAX_TARGETS_PER_GESTURE = 4;

export const TargetSchema = z.object({
  plugin: z.string().min(1),
  param: z.string().min(1),
  min: z.number().finite(),
  max: z.number().finite(),
  curve: z.enum(CURVES),
});

export const GestureMappingSchema = z.object({
  gesture: z.enum(GESTURES),
  targets: z.array(TargetSchema).min(1).max(MAX_TARGETS_PER_GESTURE),
});

/** The mapping contract (CLAUDE.md section 5). Shared by client and server. */
export const MappingSchema = z.object({
  mappings: z.array(GestureMappingSchema).min(1).max(GESTURES.length),
});

export type Gesture = (typeof GESTURES)[number];
export type Target = z.infer<typeof TargetSchema>;
export type GestureMapping = z.infer<typeof GestureMappingSchema>;
export type Mapping = z.infer<typeof MappingSchema>;

/** Current 0 to 1 value for each gesture, or null when that hand is not present. */
export type GestureValues = Record<Gesture, number | null>;
