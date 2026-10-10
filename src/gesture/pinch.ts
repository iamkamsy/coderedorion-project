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

export const DEFAULT_CALIBRATION: Calibration = { closed: 0.15, open: 1.2 };

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
