import type { Division } from "@/audio/rackSpec";
import type { Check } from "./types";

/** What the playground has observed so far. Steps complete when their check passes. */
export interface CoachSignals {
  audioOn: boolean;
  abUsed: boolean;
  params: Record<string, number>;
  division: Division | null;
  /** Every preset loaded during this session. */
  presetsLoaded: ReadonlySet<string>;
  bypassToggled: ReadonlySet<string>;
  asked: boolean;
}

export function checkPasses(check: Check | null, s: CoachSignals): boolean {
  if (!check) return false;
  switch (check.kind) {
    case "audio-on":
      return s.audioOn;
    case "ab-used":
      return s.abUsed;
    case "param-above":
      return (s.params[check.key] ?? -Infinity) > check.value;
    case "param-below":
      return (s.params[check.key] ?? Infinity) < check.value;
    case "division-set":
      return s.division === check.division;
    case "preset-loaded":
      return s.presetsLoaded.has(check.preset);
    case "bypass-toggled":
      return s.bypassToggled.has(check.plugin);
    case "asked":
      return s.asked;
  }
}
