import { z } from "zod";
import { GESTURES } from "@/mapping/types";

export const ParamEventSchema = z.object({
  time: z.iso.datetime(),
  plugin: z.string().max(32),
  param: z.string().max(32),
  value: z.number().finite(),
  gesture: z.enum(GESTURES).nullable(),
});

export const EventBatchSchema = z.object({
  sessionId: z.uuid(),
  events: z.array(ParamEventSchema).min(1).max(500),
});

export type ParamEvent = z.infer<typeof ParamEventSchema>;
