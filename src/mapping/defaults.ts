import type { Mapping } from "./types";

export interface MappingPreset {
  id: string;
  name: string;
  summary: string;
  mapping: Mapping;
}

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

export const DEFAULT_SUMMARY = "Right pinch opens reverb and delay feedback together. Left pinch sweeps the filter.";

/**
 * Hardcoded mapping presets for the Live Mapping panel, as a quick alternative to typing an
 * intent for Gemini. Every target stays inside the hard safe ranges in audio/paramSchema.ts and
 * avoids reverb decay as a live pinch target per CLAUDE.md's audio safety rules (throttled, click-prone).
 */
export const MAPPING_PRESETS: MappingPreset[] = [
  {
    id: "default",
    name: "Default",
    summary: DEFAULT_SUMMARY,
    mapping: DEFAULT_MAPPING,
  },
  {
    id: "echo-sweep",
    name: "Echo & sweep",
    summary: "Right pinch controls echo mix and timing. Left pinch sweeps filter brightness and resonance.",
    mapping: {
      mappings: [
        {
          gesture: "pinch_right",
          targets: [
            { plugin: "delay", param: "wet", min: 0, max: 0.8, curve: "linear" },
            { plugin: "delay", param: "delayTime", min: 0.05, max: 0.6, curve: "exp" },
          ],
        },
        {
          gesture: "pinch_left",
          targets: [
            { plugin: "filter", param: "frequency", min: 800, max: 10000, curve: "exp" },
            { plugin: "filter", param: "Q", min: 0.5, max: 6, curve: "linear" },
          ],
        },
      ],
    },
  },
  {
    id: "wide-and-warm",
    name: "Wide & warm",
    summary: "Right pinch sweeps brightness and adds echo. Left pinch opens the reverb wide.",
    mapping: {
      mappings: [
        {
          gesture: "pinch_right",
          targets: [
            { plugin: "filter", param: "frequency", min: 2000, max: 12000, curve: "exp" },
            { plugin: "delay", param: "wet", min: 0, max: 0.5, curve: "linear" },
          ],
        },
        {
          gesture: "pinch_left",
          targets: [{ plugin: "reverb", param: "wet", min: 0, max: 0.9, curve: "linear" }],
        },
      ],
    },
  },
];
