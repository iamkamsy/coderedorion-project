import { describe, expect, it } from "vitest";
import { HandLock, LOCK_HOLD_MS, UNLOCK_HOLD_MS } from "./lock";

const NONE = { pinky: false, rock: false };
const PINKY = { pinky: true, rock: false };
// A rock sign has the pinky up too. So does a pinching hand with the pinky out: index up, middle and ring folded.
const ROCK = { pinky: true, rock: true };

/** Feed the same pose every 33 ms (a 30 fps camera) from `from` to `to`, returning every change it reported. */
function hold(lock: HandLock, pose: typeof NONE | null, from: number, to: number) {
  const changes: string[] = [];
  for (let t = from; t <= to; t += 33) {
    const change = lock.update(pose, t);
    if (change) changes.push(change);
  }
  return changes;
}

describe("HandLock", () => {
  it("locks after the pinky has been up for half a second", () => {
    expect(LOCK_HOLD_MS).toBe(500);
    const lock = new HandLock();
    expect(hold(lock, PINKY, 0, 450)).toEqual([]);
    expect(lock.locked).toBe(false);
    expect(hold(lock, PINKY, 462, 530)).toEqual(["locked"]);
    expect(lock.locked).toBe(true);
  });

  it("reports the pinky as seen from the first frame, with progress toward the lock", () => {
    const lock = new HandLock();
    expect(lock.progress(0)).toBe(0);
    lock.update(PINKY, 0);
    expect(lock.seen).toBe(true);
    lock.update(PINKY, 250);
    expect(lock.progress(250)).toBeCloseTo(0.5);
    lock.update(NONE, 600);
    expect(lock.seen).toBe(false);
    expect(lock.progress(600)).toBe(0);
  });

  it("does not lock on a quick flick of the pinky", () => {
    const lock = new HandLock();
    hold(lock, PINKY, 0, 200);
    hold(lock, NONE, 233, 1000);
    expect(lock.locked).toBe(false);
  });

  it("survives a dropped camera frame or two while the pinky is held", () => {
    const lock = new HandLock();
    hold(lock, PINKY, 0, 200);
    lock.update(NONE, 233);
    lock.update(NONE, 266);
    expect(hold(lock, PINKY, 299, 560)).toEqual(["locked"]);
  });

  it("stays locked after the pinky goes back down", () => {
    const lock = new HandLock();
    hold(lock, PINKY, 0, 600);
    expect(hold(lock, NONE, 633, 5000)).toEqual([]);
    expect(lock.locked).toBe(true);
  });

  it("stays locked however long the pinky is kept up, and reports the lock only once", () => {
    const lock = new HandLock();
    expect(hold(lock, PINKY, 0, 5000)).toEqual(["locked"]);
    expect(lock.locked).toBe(true);
  });

  it("unlocks after a rock sign is held, and does not lock again while it is still up", () => {
    const lock = new HandLock();
    hold(lock, PINKY, 0, 600);
    hold(lock, NONE, 633, 1000);
    expect(hold(lock, ROCK, 1033, 1033 + UNLOCK_HOLD_MS - 100)).toEqual([]);
    expect(hold(lock, ROCK, 1033 + UNLOCK_HOLD_MS - 67, 6000)).toEqual(["unlocked"]);
    expect(lock.locked).toBe(false);
  });

  it("locks a pinching hand with the pinky out, even though index-and-pinky looks like a rock sign", () => {
    const lock = new HandLock();
    expect(hold(lock, ROCK, 0, 530)).toEqual(["locked"]);
  });

  it("does not unlock while the pinky that locked it is still up, however rock-like the hand looks", () => {
    const lock = new HandLock();
    expect(hold(lock, ROCK, 0, 6000)).toEqual(["locked"]);
    expect(lock.locked).toBe(true);
  });

  it("locks when the hand leaves the frame with the pinky up, without waiting out the half second", () => {
    const lock = new HandLock();
    hold(lock, PINKY, 0, 200);
    expect(hold(lock, null, 233, 1000)).toEqual(["locked"]);
    expect(lock.locked).toBe(true);
  });

  it("does not lock when the hand leaves after only a flicker of pinky", () => {
    const lock = new HandLock();
    hold(lock, PINKY, 0, 66);
    expect(hold(lock, null, 99, 1000)).toEqual([]);
    expect(lock.locked).toBe(false);
  });

  it("stays locked while the hand is out of the frame", () => {
    const lock = new HandLock();
    hold(lock, PINKY, 0, 600);
    expect(hold(lock, null, 633, 5000)).toEqual([]);
    expect(lock.locked).toBe(true);
  });

  it("release() unlocks at once", () => {
    const lock = new HandLock();
    hold(lock, PINKY, 0, 600);
    lock.release();
    expect(lock.locked).toBe(false);
    expect(lock.progress(700)).toBe(0);
  });
});
