import { describe, expect, it } from "vitest";
import { EFFECT_ORDER, defaultValuesFor, orderModules, rackPlugins } from "./rackSpec";

describe("orderModules", () => {
  it("sorts into signal order, dedupes and drops unknown ids", () => {
    expect(orderModules(["reverb", "filter", "reverb", "chorus"])).toEqual(["filter", "reverb"]);
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
