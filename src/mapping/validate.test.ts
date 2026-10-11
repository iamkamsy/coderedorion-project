import { describe, expect, it } from "vitest";
import { clampToSchema, PARAM_SPECS } from "@/audio/paramSchema";
import { DEFAULT_MAPPING } from "./defaults";
import { validateMapping } from "./validate";

describe("clampToSchema", () => {
  it("clamps to the hard range", () => {
    expect(clampToSchema("delay", "feedback", 5)).toBe(0.85);
    expect(clampToSchema("delay", "feedback", -1)).toBe(0);
    expect(clampToSchema("filter", "frequency", 20)).toBe(100);
    expect(clampToSchema("reverb", "wet", 0.5)).toBe(0.5);
  });

  it("falls back to the default for non-finite values", () => {
    expect(clampToSchema("reverb", "wet", NaN)).toBe(0.2);
    expect(clampToSchema("reverb", "wet", Infinity)).toBe(0.2);
  });

  it("throws for unknown params", () => {
    expect(() => clampToSchema("chorus", "depth", 0.5)).toThrow();
  });

  it("keeps delay feedback below runaway", () => {
    const fb = PARAM_SPECS.find((s) => s.plugin === "delay" && s.param === "feedback");
    expect(fb?.max).toBeLessThan(0.9);
  });
});

describe("validateMapping", () => {
  it("accepts the default mapping unchanged", () => {
    const r = validateMapping(DEFAULT_MAPPING);
    expect(r).toEqual({ ok: true, mapping: DEFAULT_MAPPING });
  });

  it("clamps out-of-range min and max", () => {
    const r = validateMapping({
      mappings: [{ gesture: "pinch_right", targets: [{ plugin: "delay", param: "feedback", min: -2, max: 3, curve: "linear" }] }],
    });
    expect(r.ok && r.mapping.mappings[0].targets[0]).toMatchObject({ min: 0, max: 0.85 });
  });

  it("allows inverted ranges", () => {
    const r = validateMapping({
      mappings: [{ gesture: "pinch_left", targets: [{ plugin: "filter", param: "frequency", min: 8000, max: 200, curve: "exp" }] }],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects unknown plugins and params", () => {
    expect(
      validateMapping({
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "chorus", param: "rate", min: 0, max: 1, curve: "linear" }] }],
      }).ok,
    ).toBe(false);
    expect(
      validateMapping({
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "reverb", param: "size", min: 0, max: 1, curve: "linear" }] }],
      }).ok,
    ).toBe(false);
  });

  it("rejects unknown gestures and curves", () => {
    expect(
      validateMapping({ mappings: [{ gesture: "fist", targets: [{ plugin: "reverb", param: "wet", min: 0, max: 1, curve: "linear" }] }] })
        .ok,
    ).toBe(false);
    expect(
      validateMapping({
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "reverb", param: "wet", min: 0, max: 1, curve: "sine" }] }],
      }).ok,
    ).toBe(false);
  });

  it("rejects duplicate gestures and duplicate targets", () => {
    const t = { plugin: "reverb", param: "wet", min: 0, max: 1, curve: "linear" };
    expect(
      validateMapping({
        mappings: [
          { gesture: "pinch_right", targets: [t] },
          { gesture: "pinch_right", targets: [t] },
        ],
      }).ok,
    ).toBe(false);
    expect(validateMapping({ mappings: [{ gesture: "pinch_right", targets: [t, t] }] }).ok).toBe(false);
  });

  it("rejects malformed input", () => {
    for (const bad of [null, "string", 42, {}, { mappings: [] }, { mappings: [{ gesture: "pinch_right", targets: [] }] }]) {
      expect(validateMapping(bad).ok).toBe(false);
    }
  });

  it("rejects non-numeric ranges", () => {
    expect(
      validateMapping({
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "reverb", param: "wet", min: "0", max: 1, curve: "linear" }] }],
      }).ok,
    ).toBe(false);
  });
});

describe("input conditioning params", () => {
  it("cannot be bound to a gesture", () => {
    for (const param of ["lowCut", "gateThreshold"]) {
      const r = validateMapping({
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "input", param, min: 0, max: 1, curve: "linear" }] }],
      });
      expect(r.ok).toBe(false);
    }
  });

  it("are clamped to their safe ranges", () => {
    expect(clampToSchema("input", "lowCut", 5)).toBe(20);
    expect(clampToSchema("input", "lowCut", 5000)).toBe(300);
    expect(clampToSchema("input", "gateThreshold", 0)).toBe(-20);
  });
});

describe("plugin allowlist", () => {
  const delayOnly = { plugins: ["delay"] };

  it("accepts targets on loaded effects", () => {
    const r = validateMapping(
      { mappings: [{ gesture: "pinch_right", targets: [{ plugin: "delay", param: "feedback", min: 0, max: 0.6, curve: "linear" }] }] },
      delayOnly,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects targets on effects that are not loaded", () => {
    const r = validateMapping(DEFAULT_MAPPING, delayOnly);
    expect(r.ok).toBe(false);
  });
});
