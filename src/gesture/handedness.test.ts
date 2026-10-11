import { describe, expect, it } from "vitest";
import { gestureForHandedness } from "./handedness";

describe("gestureForHandedness", () => {
  it("maps each hand to its own side", () => {
    expect(gestureForHandedness("Right")).toBe("pinch_right");
    expect(gestureForHandedness("Left")).toBe("pinch_left");
  });

  it("falls back to the left hand when MediaPipe gives no label", () => {
    expect(gestureForHandedness(undefined)).toBe("pinch_left");
  });
});
