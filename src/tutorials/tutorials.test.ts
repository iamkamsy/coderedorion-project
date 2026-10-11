import { describe, expect, it } from "vitest";
import { clampToSchema } from "@/audio/paramSchema";
import { defaultValuesFor } from "@/audio/rackSpec";
import { validateMapping } from "@/mapping/validate";
import { checkPasses, type CoachSignals } from "./checks";
import { TUTORIALS, getTutorial, nextTutorial } from "./index";

/** Static `data-tour` ids rendered by the playground. Param, bypass and module ids are checked below. */
const STATIC_TARGETS = new Set(["start-audio", "ab", "stage", "preset-bar", "assistant", "delay-division", "output-meter"]);

describe.each(TUTORIALS.map((t) => [t.slug, t] as const))("tutorial %s", (_slug, t) => {
  const rackParams = defaultValuesFor(t.modules);
  const inRack = (key: string) => key in rackParams;

  it("has a mapping limited to its own effects", () => {
    expect(validateMapping(t.mapping, { plugins: t.modules })).toEqual({ ok: true, mapping: t.mapping });
  });

  it("has presets whose values and mappings fit its rack and safe ranges", () => {
    const ids = new Set<string>();
    for (const p of t.presets) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(validateMapping(p.mapping, { plugins: t.modules })).toEqual({ ok: true, mapping: p.mapping });
      for (const [key, value] of Object.entries(p.values)) {
        expect(inRack(key), `${p.id}: ${key} is not in the rack`).toBe(true);
        const [plugin, param] = key.split(".");
        expect(clampToSchema(plugin, param, value), `${p.id}: ${key} out of range`).toBe(value);
      }
      if (p.division) expect(t.modules).toContain("delay");
    }
  });

  it("has steps that point at real controls and checkable state", () => {
    const presetIds = new Set(t.presets.map((p) => p.id));
    const stepIds = new Set<string>();
    for (const s of t.steps) {
      expect(stepIds.has(s.id)).toBe(false);
      stepIds.add(s.id);
      if (s.target) {
        const [, kind, rest] = s.target.match(/^(param|bypass|module)-(.+)$/) ?? [];
        if (kind === "param") expect(inRack(rest), s.target).toBe(true);
        else if (kind === "bypass" || kind === "module") expect(t.modules as readonly string[]).toContain(rest);
        else expect(STATIC_TARGETS.has(s.target), s.target).toBe(true);
        if (s.target === "delay-division") expect(t.modules).toContain("delay");
      }
      const c = s.check;
      if (c?.kind === "param-above" || c?.kind === "param-below") expect(inRack(c.key), c.key).toBe(true);
      if (c?.kind === "preset-loaded") expect(presetIds.has(c.preset), c.preset).toBe(true);
      if (c?.kind === "bypass-toggled") expect(t.modules).toContain(c.plugin);
      if (c?.kind === "division-set") expect(t.modules).toContain("delay");
    }
    expect(t.steps.at(-1)?.check).toBeNull();
  });

  it("has a starting mapping that a beginner can hear right away", () => {
    expect(t.mapping.mappings.some((m) => m.gesture === "pinch_right")).toBe(true);
  });
});

describe("tutorial index", () => {
  it("numbers tutorials in order with unique slugs", () => {
    expect(TUTORIALS.map((t) => t.number)).toEqual([1, 2, 3]);
    expect(new Set(TUTORIALS.map((t) => t.slug)).size).toBe(TUTORIALS.length);
    expect(TUTORIALS[0].status).toBe("ready");
  });

  it("finds tutorials and the next one", () => {
    expect(getTutorial("echoes-in-time")?.number).toBe(1);
    expect(getTutorial("nope")).toBeUndefined();
    expect(nextTutorial("echoes-in-time")?.slug).toBe("grit-and-warmth");
    expect(nextTutorial("movement")).toBeUndefined();
  });
});

describe("checkPasses", () => {
  const base: CoachSignals = {
    audioOn: false,
    abUsed: false,
    params: { "delay.feedback": 0.3 },
    division: null,
    presetsLoaded: new Set(),
    bypassToggled: new Set(),
    asked: false,
  };

  it("evaluates each kind of check", () => {
    expect(checkPasses({ kind: "audio-on" }, { ...base, audioOn: true })).toBe(true);
    expect(checkPasses({ kind: "param-above", key: "delay.feedback", value: 0.55 }, base)).toBe(false);
    expect(checkPasses({ kind: "param-above", key: "delay.feedback", value: 0.55 }, { ...base, params: { "delay.feedback": 0.6 } })).toBe(
      true,
    );
    expect(checkPasses({ kind: "param-below", key: "filter.frequency", value: 4000 }, base)).toBe(false);
    expect(checkPasses({ kind: "division-set", division: "8n." }, { ...base, division: "8n." })).toBe(true);
    expect(checkPasses({ kind: "preset-loaded", preset: "dub" }, { ...base, presetsLoaded: new Set(["dub"]) })).toBe(true);
    expect(checkPasses({ kind: "bypass-toggled", plugin: "phaser" }, { ...base, bypassToggled: new Set(["phaser"]) })).toBe(true);
    expect(checkPasses({ kind: "asked" }, base)).toBe(false);
  });

  it("never auto-completes a manual step", () => {
    expect(checkPasses(null, { ...base, audioOn: true, abUsed: true, asked: true })).toBe(false);
  });
});
