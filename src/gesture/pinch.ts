export interface Point {
  x: number;
  y: number;
  z?: number;
}

export interface Calibration {
  /** Ratio measured with thumb and index touching. */
  closed: number;
  /** Ratio measured with thumb and index fully open. */
  open: number;
}

export const DEFAULT_CALIBRATION: Calibration = { closed: 0.3, open: 1.3 };

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_TIP = 20;

/**
 * A fingertip counts as extended once it is this many times farther from the wrist than its own
 * MCP joint. Deliberately high: a relaxed, half-open palm should not count, only fingers
 * stretched out straight. Tune against the real camera if the panic stop fires too eagerly or not at all.
 */
const OPEN_HAND_EXTENSION_RATIO = 1.7;

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isFingerExtended(landmarks: readonly Point[], mcp: number, tip: number): boolean {
  const wrist = landmarks[WRIST];
  const mcpDist = dist(wrist, landmarks[mcp]);
  if (mcpDist < 1e-6) return false;
  return dist(wrist, landmarks[tip]) / mcpDist >= OPEN_HAND_EXTENSION_RATIO;
}

/**
 * Thumb tip to index tip distance divided by wrist to middle-finger MCP distance,
 * so the value does not change as the hand moves closer to or further from the camera.
 */
export function pinchRatio(landmarks: readonly Point[]): number | null {
  if (landmarks.length < 21) return null;
  const scale = dist(landmarks[WRIST], landmarks[MIDDLE_MCP]);
  if (scale < 1e-6) return null;
  return dist(landmarks[THUMB_TIP], landmarks[INDEX_TIP]) / scale;
}

/** Map a raw ratio into 0 (closed) to 1 (open) using the user's calibration. */
export function normalizePinch(ratio: number, cal: Calibration): number {
  const span = cal.open - cal.closed;
  if (span <= 1e-6) return 0;
  return Math.min(1, Math.max(0, (ratio - cal.closed) / span));
}

/**
 * True when index, middle, ring and pinky are all extended away from the wrist,
 * i.e. a flat open palm rather than a pinch or fist. Independent of hand size and
 * distance from the camera, same as pinchRatio.
 */
export function isOpenHand(landmarks: readonly Point[]): boolean {
  if (landmarks.length < 21) return false;
  return (
    isFingerExtended(landmarks, INDEX_MCP, INDEX_TIP) &&
    isFingerExtended(landmarks, MIDDLE_MCP, MIDDLE_TIP) &&
    isFingerExtended(landmarks, RING_MCP, RING_TIP) &&
    isFingerExtended(landmarks, PINKY_MCP, PINKY_TIP)
  );
}

/**
 * True when the pinky is stuck out away from the wrist while the rest of the gesture continues
 * (unlike isOpenHand, this does not require the other fingers to be extended too). Used as a
 * per-hand hold: stick the pinky out to freeze that hand's pinch at its current value.
 */
export function isPinkyExtended(landmarks: readonly Point[]): boolean {
  if (landmarks.length < 21) return false;
  return isFingerExtended(landmarks, PINKY_MCP, PINKY_TIP);
}
