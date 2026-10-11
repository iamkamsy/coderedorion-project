import type { Gesture } from "@/mapping/types";

/**
 * MediaPipe's handedness label to our gesture. Checked on the demo webcam: the label
 * MediaPipe reports matches the user's own hand ("Right" is the user's right hand), so
 * the right hand drives `pinch_right`.
 */
export function gestureForHandedness(label: string | undefined): Gesture {
  return label === "Right" ? "pinch_right" : "pinch_left";
}
