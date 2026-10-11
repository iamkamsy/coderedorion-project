import { describe, expect, it } from "vitest";
import { clampToSchema } from "./paramSchema";
import { LIVE_SOURCES, isLiveSource } from "./inputs";

describe("live source presets", () => {
  it("uses speech processing for the vocal mic only", () => {
    expect(LIVE_SOURCES.mic.constraints).toMatchObject({ noiseSuppression: true, echoCancellation: true, autoGainControl: true });
    expect(LIVE_SOURCES.line.constraints).toMatchObject({ noiseSuppression: false, echoCancellation: false, autoGainControl: false });
  });

  it("keeps low cut presets inside the schema and below a guitar's low E", () => {
    for (const preset of Object.values(LIVE_SOURCES)) {
      expect(clampToSchema("input", "lowCut", preset.lowCutHz)).toBe(preset.lowCutHz);
    }
    expect(LIVE_SOURCES.line.lowCutHz).toBeLessThan(82);
  });

  it("treats only mic and line as live", () => {
    expect(isLiveSource("loop")).toBe(false);
    expect(isLiveSource("mic")).toBe(true);
    expect(isLiveSource("line")).toBe(true);
  });
});
