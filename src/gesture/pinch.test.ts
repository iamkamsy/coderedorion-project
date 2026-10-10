import { describe, expect, it } from "vitest";
import { OneEuroFilter } from "./oneEuro";
import { isOpenHand, isPinkyExtended, normalizePinch, pinchRatio, type Point } from "./pinch";

function hand(scale: number, pinchGap: number, offset = 0): Point[] {
  const pts: Point[] = Array.from({ length: 21 }, () => ({ x: offset, y: offset }));
  pts[0] = { x: offset, y: offset + scale }; // wrist
  pts[9] = { x: offset, y: offset }; // middle MCP
  pts[4] = { x: offset, y: offset - 0.1 }; // thumb tip
  pts[8] = { x: offset + pinchGap, y: offset - 0.1 }; // index tip
  return pts;
}

/** A hand with every finger's MCP close to the wrist and tips either extended far out or curled back in. */
function handWithFingers(extended: boolean): Point[] {
  const pts: Point[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  pts[0] = { x: 0, y: 1 }; // wrist
  const mcps: [number, number][] = [
    [5, 0.9], // index MCP
    [9, 0.9], // middle MCP
    [13, 0.9], // ring MCP
    [17, 0.9], // pinky MCP
  ];
  const tips: [number, number][] = [
    [8, 0.1], // index tip
    [12, 0.1], // middle tip
    [16, 0.1], // ring tip
    [20, 0.1], // pinky tip
  ];
  for (const [i, y] of mcps) pts[i] = { x: 0, y };
  for (const [i] of tips) pts[i] = { x: 0, y: extended ? 0.1 : 0.95 };
  return pts;
}

describe("pinchRatio", () => {
  it("is independent of hand size (distance from camera)", () => {
    const near = pinchRatio(hand(0.4, 0.2));
    const far = pinchRatio(hand(0.1, 0.05, 0.3));
    expect(near).toBeCloseTo(0.5);
    expect(far).toBeCloseTo(0.5);
  });

  it("returns null for incomplete or degenerate hands", () => {
    expect(pinchRatio([])).toBeNull();
    expect(pinchRatio(hand(0, 0.1))).toBeNull();
  });
});

describe("isOpenHand", () => {
  it("is true when index, middle, ring and pinky are all extended", () => {
    expect(isOpenHand(handWithFingers(true))).toBe(true);
  });

  it("is false when the fingers are curled, as in a pinch or fist", () => {
    expect(isOpenHand(handWithFingers(false))).toBe(false);
  });

  it("returns false for incomplete hands", () => {
    expect(isOpenHand([])).toBe(false);
  });
});

describe("isPinkyExtended", () => {
  it("is true for the pinky alone, even with the rest of the hand curled (e.g. mid-pinch)", () => {
    const pts = handWithFingers(false);
    pts[20] = { x: 0, y: 0.1 }; // pinky tip stuck out, everything else curled
    expect(isPinkyExtended(pts)).toBe(true);
  });

  it("is false when the pinky is curled in", () => {
    expect(isPinkyExtended(handWithFingers(false))).toBe(false);
  });

  it("returns false for incomplete hands", () => {
    expect(isPinkyExtended([])).toBe(false);
  });
});

describe("normalizePinch", () => {
  const cal = { closed: 0.2, open: 1.2 };
  it("maps calibration range to 0..1 and clamps", () => {
    expect(normalizePinch(0.2, cal)).toBe(0);
    expect(normalizePinch(0.7, cal)).toBeCloseTo(0.5);
    expect(normalizePinch(1.2, cal)).toBe(1);
    expect(normalizePinch(0, cal)).toBe(0);
    expect(normalizePinch(3, cal)).toBe(1);
  });

  it("is safe with a degenerate calibration", () => {
    expect(normalizePinch(0.5, { closed: 1, open: 1 })).toBe(0);
  });
});

describe("OneEuroFilter", () => {
  it("smooths jitter around a steady value", () => {
    const f = new OneEuroFilter();
    let out = 0;
    for (let i = 0; i < 60; i++) out = f.filter(0.5 + (i % 2 ? 0.05 : -0.05), i * 33);
    expect(Math.abs(out - 0.5)).toBeLessThan(0.03);
  });

  it("follows a real move", () => {
    const f = new OneEuroFilter();
    let out = 0;
    for (let i = 0; i < 10; i++) out = f.filter(0, i * 33);
    for (let i = 10; i < 40; i++) out = f.filter(1, i * 33);
    expect(out).toBeGreaterThan(0.9);
  });
});
