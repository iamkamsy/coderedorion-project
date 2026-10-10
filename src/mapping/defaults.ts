import type { Mapping } from "./types";

/** Demo fallback mapping: the right-hand pinch opens up reverb and delay together. */
export const DEFAULT_MAPPING: Mapping = {
  mappings: [
    {
      gesture: "pinch_right",
      targets: [
        { plugin: "reverb", param: "wet", min: 0, max: 0.8, curve: "linear" },
        { plugin: "delay", param: "feedback", min: 0.1, max: 0.6, curve: "exp" },
      ],
    },
    {
      gesture: "pinch_left",
      targets: [{ plugin: "filter", param: "frequency", min: 400, max: 12000, curve: "exp" }],
    },
  ],
};
