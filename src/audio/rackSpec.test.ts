import { describe, expect, it } from "vitest";
import { clampToSchema } from "./paramSchema";
import {
  DIVISIONS,
  EFFECT_ORDER,
  STUDIO_BYPASSED,
  defaultValuesFor,
  divisionSeconds,
  isDivision,
  orderModules,
  rackPlugins,
} from "./rackSpec";

describe("orderModules", () => {
  it("sorts into signal order, dedupes and drops unknown ids", () => {
    expect(orderModules(["reverb", "filter", "reverb", "chorus"])).toEqual(["filter", "reverb"]);
    expect(orderModules(["delay", "distortion"])).toEqual(["distortion", "delay"]);
    expect(orderModules([...EFFECT_ORDER].reverse())).toEqual([...EFFECT_ORDER]);
    expect(orderModules([])).toEqual([]);
  });
});

describe("defaultValuesFor", () => {
  it("includes the input stage and only the loaded effects", () => {
    const values = defaultValuesFor(["delay"]);
    expect(Object.keys(values).sort()).toEqual(
      ["delay.delayTime", "delay.feedback", "delay.wet", "input.gateThreshold", "input.lowCut"].sort(),
    );
    expect(rackPlugins(["delay"])).toEqual(["input", "delay"]);
  });

  it("returns a fresh object each time so racks never share state", () => {
    const a = defaultValuesFor(["filter"]);
    a["filter.Q"] = 7;
    expect(defaultValuesFor(["filter"])["filter.Q"]).toBe(1);
  });
});

describe("tempo-synced delay", () => {
  it("converts divisions to seconds at a tempo", () => {
    expect(divisionSeconds("4n", 120)).toBeCloseTo(0.5);
    expect(divisionSeconds("8n.", 96)).toBeCloseTo(0.46875);
    expect(divisionSeconds("16n", 96)).toBeCloseTo(0.15625);
  });

  it("keeps every division inside the delay's safe range at the loop tempo", () => {
    for (const d of Object.keys(DIVISIONS)) {
      if (!isDivision(d)) throw new Error(d);
      const s = divisionSeconds(d, 96);
      expect(s).toBe(clampToSchema("delay", "delayTime", s));
    }
  });

  it("clamps divisions that would exceed the range at slow tempos", () => {
    expect(divisionSeconds("4n.", 40)).toBe(1);
  });
});

describe("new effects", () => {
  it("clamp drive and phaser ranges", () => {
    expect(clampToSchema("distortion", "drive", 2)).toBe(0.9);
    expect(clampToSchema("phaser", "frequency", 50)).toBe(8);
    expect(clampToSchema("phaser", "octaves", 0)).toBe(1);
  });

  it("start bypassed in the studio so the first sound is clean", () => {
    expect([...STUDIO_BYPASSED].sort()).toEqual(["distortion", "phaser"]);
    expect(EFFECT_ORDER[0]).toBe("distortion");
  });
});
