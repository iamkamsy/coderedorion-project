import { describe, expect, it } from "vitest";
import { DEFAULT_MAPPING } from "./defaults";
import { applyMapping, boundParams, computeChanges, isTargetBound, scaleValue, toggleTarget } from "./engine";
import type { Mapping } from "./types";

describe("scaleValue", () => {
  it("linear interpolates", () => {
    expect(scaleValue(0, 0, 0.8, "linear")).toBe(0);
    expect(scaleValue(0.5, 0, 0.8, "linear")).toBeCloseTo(0.4);
    expect(scaleValue(1, 0, 0.8, "linear")).toBeCloseTo(0.8);
  });

  it("exp is geometric for positive ranges", () => {
    expect(scaleValue(0.5, 100, 10000, "exp")).toBeCloseTo(1000);
    expect(scaleValue(0, 100, 10000, "exp")).toBeCloseTo(100);
    expect(scaleValue(1, 100, 10000, "exp")).toBeCloseTo(10000);
  });

  it("exp falls back to squared when the range touches zero", () => {
    expect(scaleValue(0.5, 0, 1, "exp")).toBeCloseTo(0.25);
  });

  it("log rises quickly", () => {
    expect(scaleValue(0.5, 0, 1, "log")).toBeCloseTo(0.75);
  });

  it("clamps the input to 0..1 and handles inverted ranges", () => {
    expect(scaleValue(2, 0, 1, "linear")).toBe(1);
    expect(scaleValue(-1, 0, 1, "linear")).toBe(0);
    expect(scaleValue(NaN, 0, 1, "linear")).toBe(0);
    expect(scaleValue(0.25, 1, 0, "linear")).toBeCloseTo(0.75);
  });
});

describe("computeChanges / applyMapping", () => {
  it("drives every target of a gesture and skips absent hands", () => {
    const changes = computeChanges(DEFAULT_MAPPING, { pinch_right: 1, pinch_left: null });
    expect(changes.map((c) => `${c.plugin}.${c.param}`)).toEqual(["reverb.wet", "delay.feedback"]);
    expect(changes[0].value).toBeCloseTo(0.8);
    expect(changes[1].value).toBeCloseTo(0.6);
  });

  it("clamps to the schema even if a mapping bypassed validation", () => {
    const unsafe: Mapping = {
      mappings: [{ gesture: "pinch_right", targets: [{ plugin: "delay", param: "feedback", min: 0, max: 5, curve: "linear" }] }],
    };
    expect(computeChanges(unsafe, { pinch_right: 1, pinch_left: null })[0].value).toBe(0.85);
  });

  it("calls setParam for each change", () => {
    const calls: string[] = [];
    applyMapping(DEFAULT_MAPPING, { pinch_right: 0.5, pinch_left: 0.5 }, (p, k) => calls.push(`${p}.${k}`));
    expect(calls).toEqual(["reverb.wet", "delay.feedback", "filter.frequency"]);
  });

  it("reports bound params", () => {
    const bound = boundParams(DEFAULT_MAPPING);
    expect(bound.get("reverb.wet")).toBe("pinch_right");
    expect(bound.get("filter.frequency")).toBe("pinch_left");
    expect(bound.has("filter.Q")).toBe(false);
  });
});

describe("isTargetBound", () => {
  it("is true only for the gesture actually driving that parameter", () => {
    expect(isTargetBound(DEFAULT_MAPPING, "pinch_right", "reverb", "wet")).toBe(true);
    expect(isTargetBound(DEFAULT_MAPPING, "pinch_left", "reverb", "wet")).toBe(false);
  });
});

describe("toggleTarget", () => {
  it("adds a target to a gesture that already has one, at the parameter's full safe range", () => {
    const next = toggleTarget(DEFAULT_MAPPING, "pinch_right", "filter", "Q");
    expect(next).not.toBeNull();
    const gm = next!.mappings.find((m) => m.gesture === "pinch_right")!;
    expect(gm.targets.map((t) => `${t.plugin}.${t.param}`)).toEqual(["reverb.wet", "delay.feedback", "filter.Q"]);
    expect(gm.targets.at(-1)).toMatchObject({ min: 0.5, max: 8, curve: "linear" });
  });

  it("creates a new gesture entry for a hand that currently has none", () => {
    const rightOnly: Mapping = { mappings: [{ gesture: "pinch_right", targets: [{ plugin: "reverb", param: "wet", min: 0, max: 0.8, curve: "linear" }] }] };
    const next = toggleTarget(rightOnly, "pinch_left", "filter", "frequency");
    expect(next?.mappings.map((m) => m.gesture).sort()).toEqual(["pinch_left", "pinch_right"]);
  });

  it("removes a bound target, and drops the gesture entirely once it has none left", () => {
    const removedWet = toggleTarget(DEFAULT_MAPPING, "pinch_right", "reverb", "wet");
    expect(removedWet?.mappings.find((m) => m.gesture === "pinch_right")?.targets.map((t) => t.param)).toEqual(["feedback"]);

    const soleTarget: Mapping = { mappings: [{ gesture: "pinch_left", targets: [{ plugin: "filter", param: "frequency", min: 400, max: 12000, curve: "exp" }] }] };
    expect(toggleTarget(soleTarget, "pinch_left", "filter", "frequency")).toBeNull();
  });

  it("refuses to add past the per-gesture target limit", () => {
    const full: Mapping = {
      mappings: [
        {
          gesture: "pinch_right",
          targets: [
            { plugin: "reverb", param: "wet", min: 0, max: 0.8, curve: "linear" },
            { plugin: "delay", param: "wet", min: 0, max: 0.8, curve: "linear" },
            { plugin: "delay", param: "feedback", min: 0, max: 0.8, curve: "linear" },
            { plugin: "delay", param: "delayTime", min: 0.05, max: 1, curve: "exp" },
          ],
        },
      ],
    };
    expect(toggleTarget(full, "pinch_right", "filter", "Q")).toBeNull();
  });

  it("returns null for an unknown plugin or parameter", () => {
    expect(toggleTarget(DEFAULT_MAPPING, "pinch_right", "nope", "nope")).toBeNull();
  });
});
