import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { Gesture } from "@/mapping/types";
import { gestureForHandedness } from "./handedness";
import { OneEuroFilter } from "./oneEuro";
import { isOpenHand, isPinkyExtended, isRockSign, pinchRatio } from "./pinch";

/** Copied from node_modules on install (scripts/copy-mediapipe.mjs). */
const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/models/hand_landmarker.task";
const HAND_CONFIDENCE = 0.7;

export interface TrackedHand {
  gesture: Gesture;
  landmarks: NormalizedLandmark[];
  /** Smoothed thumb-index ratio, before calibration. */
  ratio: number;
  /** True for a flat open palm (all fingers extended), as opposed to a pinch or fist. */
  isOpen: boolean;
  /** True when the pinky is stuck out. Held, it locks this hand's pinch at its current value. */
  pinkyExtended: boolean;
  /** True for a rock sign (index and pinky up). Held, it unlocks this hand. */
  isRock: boolean;
}

export type TrackerFrame = { hands: TrackedHand[]; timestamp: number };

export const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS;

/** Runs MediaPipe Hand Landmarker on a video element, entirely in the browser. */
export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private rafId = 0;
  private lastVideoTime = -1;
  private filters: Record<Gesture, OneEuroFilter> = {
    pinch_left: new OneEuroFilter(),
    pinch_right: new OneEuroFilter(),
  };

  static async create(): Promise<HandTracker> {
    const tracker = new HandTracker();
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const options = {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" as const },
      runningMode: "VIDEO" as const,
      numHands: 2,
      // Stricter than the 0.5 defaults, so a face or a shadow is not taken for a hand.
      minHandDetectionConfidence: HAND_CONFIDENCE,
      minHandPresenceConfidence: HAND_CONFIDENCE,
    };
    try {
      tracker.landmarker = await HandLandmarker.createFromOptions(fileset, options);
    } catch {
      tracker.landmarker = await HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: "CPU" },
      });
    }
    return tracker;
  }

  start(video: HTMLVideoElement, onFrame: (frame: TrackerFrame) => void) {
    this.stop();
    const tick = () => {
      this.rafId = requestAnimationFrame(tick);
      if (!this.landmarker || video.readyState < 2 || video.currentTime === this.lastVideoTime) return;
      this.lastVideoTime = video.currentTime;
      const now = performance.now();
      const result = this.landmarker.detectForVideo(video, now);

      const hands: TrackedHand[] = [];
      const seen = new Set<Gesture>();
      result.landmarks.forEach((landmarks, i) => {
        const gesture = gestureForHandedness(result.handedness[i]?.[0]?.categoryName);
        if (seen.has(gesture)) return;
        const raw = pinchRatio(landmarks);
        if (raw === null) return;
        seen.add(gesture);
        hands.push({
          gesture,
          landmarks,
          ratio: this.filters[gesture].filter(raw, now),
          isOpen: isOpenHand(landmarks),
          pinkyExtended: isPinkyExtended(landmarks),
          isRock: isRockSign(landmarks),
        });
      });
      for (const g of Object.keys(this.filters) as Gesture[]) if (!seen.has(g)) this.filters[g].reset();

      onFrame({ hands, timestamp: now });
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
    this.lastVideoTime = -1;
  }

  dispose() {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
  }
}
