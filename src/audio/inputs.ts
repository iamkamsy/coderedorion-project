export type SourceKind = "loop" | "mic" | "line";

export interface LiveSourcePreset {
  label: string;
  /** Browser audio processing. Speech processing helps a voice and wrecks an instrument's tone. */
  constraints: MediaTrackConstraints;
  /** Low cut applied when switching to this source. */
  lowCutHz: number;
}

export const SOURCE_LABEL: Record<SourceKind, string> = {
  loop: "Test loop",
  mic: "Vocal mic",
  line: "Instrument / line in",
};

export const LIVE_SOURCES: Record<Exclude<SourceKind, "loop">, LiveSourcePreset> = {
  mic: {
    label: SOURCE_LABEL.mic,
    // Browser noise suppression and gain control duck the voice in and out, so pass it through.
    constraints: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
    lowCutHz: 100,
  },
  line: {
    label: SOURCE_LABEL.line,
    // Raw signal: a guitar's low E is 82 Hz, and suppression would treat sustain as noise.
    constraints: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    lowCutHz: 40,
  },
};

export function isLiveSource(kind: SourceKind): kind is Exclude<SourceKind, "loop"> {
  return kind !== "loop";
}
