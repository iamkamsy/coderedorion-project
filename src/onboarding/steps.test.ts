import { describe, expect, it } from "vitest";
import { STUDIO_MODULES } from "@/audio/rackSpec";
import { validateMapping } from "@/mapping/validate";
import {
  DREAMY_FALLBACK,
  ONBOARDING_STEPS,
  TOUR_INTENT,
  isRevealed,
  lingerSeconds,
  pinchedClosed,
  stepDone,
  tryTarget,
  widenSeen,
  type OnboardingSignals,
  type Seen,
} from "./steps";

const NO_HANDS = { pinch_left: null, pinch_right: null };
const base: OnboardingSignals = {
  audioOn: true,
  stopped: false,
  seen: { index: 0, ranges: {} },
  locked: false,
  unlocked: false,
  aiApplied: false,
};
const indexOf = (id: string) => ONBOARDING_STEPS.findIndex((s) => s.id === id);
const step = (id: string) => ONBOARDING_STEPS[indexOf(id)];

describe("onboarding steps", () => {
  it("has unique ids and copy short enough to read aloud", () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ONBOARDING_STEPS) {
      expect(s.title.length).toBeLessThanOrEqual(60);
      expect(s.body.length).toBeLessThanOrEqual(280);
    }
  });

  it("starts by starting the loop and ends once the sound is back", () => {
    expect(ONBOARDING_STEPS[0].check).toEqual({ kind: "playing" });
    expect(ONBOARDING_STEPS.at(-1)?.check).toEqual({ kind: "playing" });
  });

  it("teaches the open palm last, because it silences the audio", () => {
    expect(indexOf("palm")).toBe(ONBOARDING_STEPS.length - 2);
  });

  it("shows gestures first, then the rack, the spectrum and the assistant in that order", () => {
    const gestures = ["start-loop", "right-pinch", "left-pinch", "pinky", "rock"].map(indexOf);
    expect(Math.max(...gestures)).toBeLessThan(indexOf("params"));
    expect(indexOf("params")).toBeLessThan(indexOf("spectrum"));
    expect(indexOf("spectrum")).toBeLessThan(indexOf("assistant"));
  });
});

describe("isRevealed", () => {
  it("hides every panel during the gesture steps", () => {
    for (const panel of ["rack", "spectrum", "assistant"] as const) expect(isRevealed(panel, indexOf("rock"))).toBe(false);
  });

  it("reveals each panel at its own step and keeps it afterwards", () => {
    expect(isRevealed("rack", indexOf("params"))).toBe(true);
    expect(isRevealed("spectrum", indexOf("params"))).toBe(false);
    expect(isRevealed("spectrum", indexOf("spectrum"))).toBe(true);
    expect(isRevealed("assistant", indexOf("spectrum"))).toBe(false);
    expect(isRevealed("assistant", indexOf("assistant"))).toBe(true);
    for (const panel of ["rack", "spectrum", "assistant"] as const) expect(isRevealed(panel, ONBOARDING_STEPS.length - 1)).toBe(true);
  });
});

describe("widenSeen", () => {
  it("tracks the lowest and highest value per hand", () => {
    let seen: Seen = { index: 1, ranges: {} };
    seen = widenSeen(seen, 1, { pinch_left: null, pinch_right: 0.5 });
    seen = widenSeen(seen, 1, { pinch_left: null, pinch_right: 0.1 });
    seen = widenSeen(seen, 1, { pinch_left: 0.4, pinch_right: 0.9 });
    expect(seen.ranges).toEqual({ pinch_right: { min: 0.1, max: 0.9 }, pinch_left: { min: 0.4, max: 0.4 } });
  });

  it("starts over when the step changes", () => {
    const before = widenSeen({ index: 1, ranges: {} }, 1, { pinch_left: 0, pinch_right: 1 });
    expect(widenSeen(before, 2, { pinch_left: null, pinch_right: 0.5 })).toEqual({
      index: 2,
      ranges: { pinch_right: { min: 0.5, max: 0.5 } },
    });
  });

  it("returns the same object when nothing changed, so it is safe to store in state", () => {
    const seen = widenSeen({ index: 1, ranges: {} }, 1, { pinch_left: null, pinch_right: 0.5 });
    expect(widenSeen(seen, 1, { pinch_left: null, pinch_right: 0.5 })).toBe(seen);
    expect(widenSeen(seen, 1, NO_HANDS)).toBe(seen);
  });
});

describe("pinchedClosed", () => {
  it("needs a hand that was open and is now closed", () => {
    const opened = widenSeen({ index: 0, ranges: {} }, 0, { pinch_left: null, pinch_right: 0.8 });
    expect(pinchedClosed(opened, { pinch_left: null, pinch_right: 0.8 })).toBe(false);
    expect(pinchedClosed(opened, { pinch_left: null, pinch_right: 0.05 })).toBe(true);
  });

  it("ignores a hand that arrives already closed, such as a fist", () => {
    const fist = widenSeen({ index: 0, ranges: {} }, 0, { pinch_left: 0.05, pinch_right: null });
    expect(pinchedClosed(fist, { pinch_left: 0.05, pinch_right: null })).toBe(false);
  });

  it("is false with no hands", () => {
    expect(pinchedClosed({ index: 0, ranges: {} }, NO_HANDS)).toBe(false);
  });
});

describe("stepDone", () => {
  it("start-loop completes once the loop is audible", () => {
    expect(stepDone(step("start-loop"), { ...base, stopped: true })).toBe(false);
    expect(stepDone(step("start-loop"), { ...base, audioOn: false })).toBe(false);
    expect(stepDone(step("start-loop"), base)).toBe(true);
  });

  it("a pinch step completes after that hand sweeps from closed to open", () => {
    const i = indexOf("right-pinch");
    const half = { ...base, seen: { index: i, ranges: { pinch_right: { min: 0.1, max: 0.5 } } } };
    const wrongHand = { ...base, seen: { index: i, ranges: { pinch_left: { min: 0, max: 1 } } } };
    const full = { ...base, seen: { index: i, ranges: { pinch_right: { min: 0.1, max: 0.9 } } } };
    expect(stepDone(step("right-pinch"), half)).toBe(false);
    expect(stepDone(step("right-pinch"), wrongHand)).toBe(false);
    expect(stepDone(step("right-pinch"), full)).toBe(true);
    const left = { ...base, seen: { index: indexOf("left-pinch"), ranges: { pinch_left: { min: 0, max: 1 } } } };
    expect(stepDone(step("left-pinch"), left)).toBe(true);
  });

  it("does not count a sweep made during an earlier step", () => {
    const stale = { ...base, seen: { index: indexOf("right-pinch"), ranges: { pinch_right: { min: 0, max: 1 } } } };
    expect(stepDone(step("params"), stale)).toBe(false);
  });

  it("unlocking comes straight after locking, so no later step starts with a frozen hand", () => {
    expect(indexOf("rock")).toBe(indexOf("pinky") + 1);
  });

  it("pinky, rock, assistant and palm follow their signals", () => {
    expect(stepDone(step("pinky"), base)).toBe(false);
    expect(stepDone(step("pinky"), { ...base, locked: true })).toBe(true);
    expect(stepDone(step("rock"), { ...base, locked: true })).toBe(false);
    expect(stepDone(step("rock"), { ...base, unlocked: true })).toBe(true);
    expect(stepDone(step("assistant"), base)).toBe(false);
    expect(stepDone(step("assistant"), { ...base, aiApplied: true })).toBe(true);
    expect(stepDone(step("palm"), base)).toBe(false);
    expect(stepDone(step("palm"), { ...base, stopped: true })).toBe(true);
  });

  it("the last card completes once the sound is back, same as the first", () => {
    const last = ONBOARDING_STEPS.at(-1)!;
    expect(stepDone(last, { ...base, stopped: true })).toBe(false);
    expect(stepDone(last, { ...base, audioOn: false })).toBe(false);
    expect(stepDone(last, base)).toBe(true);
  });
});

describe("pointers", () => {
  it("the gesture steps point at nothing: the camera has the whole screen", () => {
    for (const id of ["start-loop", "right-pinch", "left-pinch", "pinky", "rock", "palm"]) {
      expect(step(id).pointers).toEqual([]);
      expect(step(id).pointsAt).toBeUndefined();
    }
  });

  it("the rack step points at whatever the right pinch drives", () => {
    expect(step("params").pointsAt).toBe("pinch_right");
  });

  it("the spectrum step points at the spectrum and at whatever the left pinch drives", () => {
    expect(step("spectrum").pointers.map((p) => p.target)).toEqual(["spectrum"]);
    expect(step("spectrum").pointsAt).toBe("pinch_left");
  });

  it("the assistant step points at the suggestion the tour taps", () => {
    expect(step("assistant").pointers.map((p) => p.target)).toEqual([tryTarget(TOUR_INTENT)]);
  });
});

describe("lingerSeconds", () => {
  it("gives the user seven seconds to play with a gesture before moving on", () => {
    for (const id of ["start-loop", "right-pinch", "left-pinch", "pinky", "rock", "params", "spectrum"])
      expect(lingerSeconds(step(id))).toBe(7);
  });

  it("moves on quickly once the palm has silenced the sound", () => {
    expect(lingerSeconds(step("palm"))).toBe(1);
  });
});

describe("DREAMY_FALLBACK", () => {
  it("is a mapping the studio rack accepts unchanged", () => {
    expect(validateMapping(DREAMY_FALLBACK.mapping, { plugins: STUDIO_MODULES })).toEqual({ ok: true, mapping: DREAMY_FALLBACK.mapping });
  });
});
