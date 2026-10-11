import { describe, expect, it } from "vitest";
import { isWakePhrase } from "./wakeWord";

describe("isWakePhrase", () => {
  it("hears the phrase and common mishearings", () => {
    for (const t of [
      "hey gesture labs",
      "Hey, Gesture Labs!",
      "ok gesture lab make it darker",
      "hey gestures labs",
      "hey jester labs",
      "gesture labs",
      "a gestural labs",
      "hey just your labs",
      "hey gesture lapse",
      "hey gesture lab's",
      "hey gesturelabs",
      "hey gesture laps",
    ]) {
      expect(isWakePhrase(t), t).toBe(true);
    }
  });

  it("ignores speech without the phrase", () => {
    for (const t of ["hey there", "make it dreamier", "hey gesture", "the lab is open", "gesturing at the lamp"]) {
      expect(isWakePhrase(t), t).toBe(false);
    }
  });
});
