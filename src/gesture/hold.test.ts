import { describe, expect, it } from "vitest";
import { HoldTimer } from "./hold";

describe("HoldTimer", () => {
  it("fires once the pose has been held for the full time, not before", () => {
    const t = new HoldTimer(1000);
    expect(t.update(true, 0)).toBe(false);
    expect(t.update(true, 999)).toBe(false);
    expect(t.update(true, 1000)).toBe(true);
  });

  it("fires only once per hold", () => {
    const t = new HoldTimer(1000);
    t.update(true, 0);
    expect(t.update(true, 1000)).toBe(true);
    expect(t.update(true, 2500)).toBe(false);
  });

  it("starts over when the pose breaks, so a one-frame glitch cannot trigger it", () => {
    const t = new HoldTimer(1000);
    t.update(true, 0);
    t.update(false, 900);
    expect(t.update(true, 1000)).toBe(false);
    expect(t.update(true, 1999)).toBe(false);
    expect(t.update(true, 2000)).toBe(true);
  });

  it("can fire again after the pose is released", () => {
    const t = new HoldTimer(1000);
    t.update(true, 0);
    t.update(true, 1000);
    t.update(false, 1100);
    t.update(true, 1200);
    expect(t.update(true, 2200)).toBe(true);
  });

  it("is pending only while a hold is building", () => {
    const t = new HoldTimer(1000);
    expect(t.pending).toBe(false);
    t.update(true, 0);
    expect(t.pending).toBe(true);
    t.update(true, 1000);
    expect(t.pending).toBe(false);
  });
});

describe("HoldTimer with a grace period", () => {
  it("rides out a break shorter than the grace period", () => {
    const t = new HoldTimer(500, 150);
    t.update(true, 0);
    t.update(true, 100);
    t.update(false, 200);
    t.update(false, 240);
    expect(t.update(true, 400)).toBe(false);
    expect(t.update(true, 500)).toBe(true);
  });

  it("starts over after a break longer than the grace period", () => {
    const t = new HoldTimer(500, 150);
    t.update(true, 0);
    t.update(false, 200);
    expect(t.pending).toBe(false);
    expect(t.update(true, 500)).toBe(false);
    expect(t.update(true, 1000)).toBe(true);
  });

  it("never completes on a frame where the pose is missing", () => {
    const t = new HoldTimer(500, 150);
    t.update(true, 0);
    t.update(true, 450);
    expect(t.update(false, 520)).toBe(false);
    expect(t.update(true, 560)).toBe(true);
  });
});

describe("HoldTimer progress", () => {
  it("runs from 0 to 1 over the hold and stays at 1 once it has fired", () => {
    const t = new HoldTimer(1000);
    expect(t.progress(0)).toBe(0);
    t.update(true, 0);
    expect(t.progress(250)).toBeCloseTo(0.25);
    t.update(true, 1000);
    expect(t.progress(3000)).toBe(1);
    t.update(false, 3100);
    expect(t.progress(3100)).toBe(0);
  });
});

describe("HoldTimer heldMs", () => {
  it("counts only up to the last frame the pose was seen", () => {
    const t = new HoldTimer(500, 150);
    expect(t.heldMs).toBe(0);
    t.update(true, 0);
    t.update(true, 66);
    t.update(false, 100);
    t.update(false, 140);
    expect(t.heldMs).toBe(66);
  });
});
