import { z } from "zod";
import { DIVISIONS, EFFECT_ORDER } from "@/audio/rackSpec";
import { MappingSchema } from "@/mapping/types";

const DivisionSchema = z.enum(Object.keys(DIVISIONS) as [keyof typeof DIVISIONS, ...(keyof typeof DIVISIONS)[]]);
const ParamKey = z.string().regex(/^[a-z]+\.[A-Za-z]+$/);

/** What has to happen for a step to complete on its own. Null means the user clicks Next. */
export const CheckSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("audio-on") }),
  z.object({ kind: z.literal("ab-used") }),
  z.object({ kind: z.literal("param-above"), key: ParamKey, value: z.number() }),
  z.object({ kind: z.literal("param-below"), key: ParamKey, value: z.number() }),
  z.object({ kind: z.literal("division-set"), division: DivisionSchema }),
  z.object({ kind: z.literal("preset-loaded"), preset: z.string() }),
  z.object({ kind: z.literal("bypass-toggled"), plugin: z.enum(EFFECT_ORDER) }),
  z.object({ kind: z.literal("asked") }),
]);

export const StepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(60),
  body: z.string().min(1).max(280),
  /** `data-tour` id of the control the pop-up points at. Null shows a centered card. */
  target: z.string().nullable(),
  check: CheckSchema.nullable(),
});

export const PresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(30),
  description: z.string().min(1).max(140),
  values: z.record(ParamKey, z.number()),
  division: DivisionSchema.nullable(),
  mapping: MappingSchema,
  summary: z.string().min(1).max(200),
});

export const TutorialSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  number: z.number().int().positive(),
  title: z.string().min(1).max(40),
  tagline: z.string().min(1).max(90),
  /** The one idea this tutorial teaches, in plain words. */
  idea: z.string().min(1).max(280),
  minutes: z.number().int().positive(),
  status: z.enum(["ready", "preview"]),
  modules: z.array(z.enum(EFFECT_ORDER)).min(1),
  mapping: MappingSchema,
  summary: z.string().min(1).max(200),
  presets: z.array(PresetSchema).min(1).max(4),
  steps: z.array(StepSchema).min(2),
  /** Suggested questions for explain mode. */
  asks: z.array(z.string().min(2).max(120)).min(1).max(4),
  /** Suggested sound changes for mapping mode. */
  tries: z.array(z.string().min(2).max(80)).min(1).max(4),
  recap: z.array(z.string().min(1).max(160)).min(1).max(4),
});

export type Check = z.infer<typeof CheckSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Preset = z.infer<typeof PresetSchema>;
export type Tutorial = z.infer<typeof TutorialSchema>;
