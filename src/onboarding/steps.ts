import { GESTURES, type Gesture, type GestureValues, type Mapping } from "@/mapping/types";

/** Side panels the tour opens one at a time. Until then the camera has the whole screen. */
export type Panel = "rack" | "spectrum" | "assistant";

export type DemoKind = "pinch" | "pinky" | "rock" | "palm" | "thumbsUp";

/** A small arrow beside a control: to its left pointing right, or above it pointing down. */
export interface Pointer {
  /** `data-tour` id of the control. */
  target: string;
  side: "left" | "top";
}

/** `data-tour` id of one of the assistant's suggestion buttons. */
export function tryTarget(suggestion: string): string {
  return `try:${suggestion}`;
}

export type OnboardingCheck =
  | { kind: "playing" }
  | { kind: "sweep"; gesture: Gesture }
  | { kind: "locked" }
  | { kind: "unlocked" }
  | { kind: "ai-applied" }
  | { kind: "stopped" };

export interface OnboardingStep {
  id: string;
  title: string;
  body: string;
  /** Animated hand shown on the card. */
  demo: { kind: DemoKind; hand: "left" | "right" } | null;
  /** Controls this step puts an arrow on. */
  pointers: readonly Pointer[];
  /** Also put an arrow on every parameter this gesture is driving right now. */
  pointsAt?: Gesture;
  /** Panel that opens when this step begins. */
  reveals: Panel | null;
  /** What completes the step on its own. Null waits for the user. */
  check: OnboardingCheck | null;
  /** Shown once the check passes. When set, the step waits for Next so the user can try the result. */
  doneNote?: string;
}

/** The intro's id for "finished" tracking, alongside the lesson slugs. */
export const INTRO_SLUG = "intro";

/** The suggestion the tour taps in the assistant. Must match one of the studio's suggestion buttons. */
export const TOUR_INTENT = "Make it dreamier";

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "start-loop",
    title: "Pinch to start the loop",
    body: "Hold a hand up to the camera, then touch your thumb and index finger together. That pinch starts the music.",
    demo: { kind: "pinch", hand: "right" },
    pointers: [],
    reveals: null,
    check: { kind: "playing" },
  },
  {
    id: "right-pinch",
    title: "Right hand adds space",
    body: "Slowly open and close your right thumb and finger. Open means more reverb and echo. Closed is dry.",
    demo: { kind: "pinch", hand: "right" },
    pointers: [],
    reveals: null,
    check: { kind: "sweep", gesture: "pinch_right" },
  },
  {
    id: "left-pinch",
    title: "Left hand sets the brightness",
    body: "Now the left hand. Open to let the highs through. Close to make the sound dark and muffled.",
    demo: { kind: "pinch", hand: "left" },
    pointers: [],
    reveals: null,
    check: { kind: "sweep", gesture: "pinch_left" },
  },
  {
    id: "pinky",
    title: "Pinky out to lock",
    body: "Found a sound you like? Hold your pinky out for half a second. That hand locks where it is, so you can relax your fingers.",
    demo: { kind: "pinky", hand: "right" },
    pointers: [],
    reveals: null,
    check: { kind: "locked" },
  },
  {
    id: "rock",
    title: "Rock sign to unlock",
    body: "To take control back, hold up your index finger and pinky with the middle two folded down. One second and the hand is live again.",
    demo: { kind: "rock", hand: "right" },
    pointers: [],
    reveals: null,
    check: { kind: "unlocked" },
  },
  {
    id: "params",
    title: "These are the knobs you moved",
    body: "Every effect lives here. Pinch with your right hand again and watch the knobs by the arrows follow your fingers.",
    demo: { kind: "pinch", hand: "right" },
    pointers: [],
    pointsAt: "pinch_right",
    reveals: "rack",
    check: { kind: "sweep", gesture: "pinch_right" },
  },
  {
    id: "spectrum",
    title: "See your sound",
    body: "This graph runs from low notes on the left to high notes on the right. Sweep your left hand and watch the highs come and go.",
    demo: { kind: "pinch", hand: "left" },
    pointers: [{ target: "spectrum", side: "left" }],
    pointsAt: "pinch_left",
    reveals: "spectrum",
    check: { kind: "sweep", gesture: "pinch_left" },
  },
  {
    id: "assistant",
    title: "Ask for a sound in plain words",
    body: "Describe what you want and the AI remaps your pinch. Watch: we'll tap Make it dreamier, and it will tell you what it changed.",
    demo: null,
    pointers: [{ target: tryTarget(TOUR_INTENT), side: "top" }],
    reveals: "assistant",
    check: { kind: "ai-applied" },
    doneNote: "Applied. Pinch again to hear the difference, then press Next.",
  },
  {
    id: "palm",
    title: "Open palm to stop",
    body: "Last one. Hold up a flat, open hand with every finger spread for two seconds and the sound stops. It's your panic button.",
    demo: { kind: "palm", hand: "right" },
    pointers: [],
    reveals: null,
    check: { kind: "stopped" },
  },
  {
    id: "done",
    title: "You're ready",
    body: "That's the whole rack: pinch to shape, pinky to hold, palm to stop, and ask the AI for new ideas. Give a thumbs up, or press Start playing, to bring the sound back.",
    demo: { kind: "thumbsUp", hand: "right" },
    pointers: [],
    reveals: null,
    check: { kind: "playing" },
  },
];

/** Applied when the AI is slow or down, so the tour never stalls. */
export const DREAMY_FALLBACK: { mapping: Mapping; summary: string } = {
  mapping: {
    mappings: [
      {
        gesture: "pinch_right",
        targets: [
          { plugin: "reverb", param: "wet", min: 0.3, max: 0.9, curve: "linear" },
          { plugin: "delay", param: "feedback", min: 0.3, max: 0.7, curve: "linear" },
        ],
      },
      {
        gesture: "pinch_left",
        targets: [{ plugin: "filter", param: "frequency", min: 300, max: 6000, curve: "exp" }],
      },
    ],
  },
  summary: "Dreamier: your right pinch now opens a long, washy reverb with more echo, and your left pinch keeps the highs soft.",
};

export function isRevealed(panel: Panel, index: number): boolean {
  const at = ONBOARDING_STEPS.findIndex((s) => s.reveals === panel);
  return at !== -1 && at <= index;
}

/** Lowest and highest value each hand has reached since step `index` began. */
export interface Seen {
  index: number;
  ranges: Partial<Record<Gesture, { min: number; max: number }>>;
}

/** Fold the current values into `seen`, starting over on a new step. Returns `seen` itself when nothing changed. */
export function widenSeen(seen: Seen, index: number, values: GestureValues): Seen {
  const fresh = seen.index !== index;
  const ranges = fresh ? {} : { ...seen.ranges };
  let changed = fresh;
  for (const g of GESTURES) {
    const v = values[g];
    if (v === null) continue;
    const r = ranges[g];
    if (r && v >= r.min && v <= r.max) continue;
    ranges[g] = r ? { min: Math.min(r.min, v), max: Math.max(r.max, v) } : { min: v, max: v };
    changed = true;
  }
  return changed ? { index, ranges } : seen;
}

const CLOSED = 0.2;
const OPEN = 0.7;
/** How far open a hand must have been before closing it counts as a deliberate pinch. */
const WAS_OPEN = 0.5;

/** True when a hand that was open during this step is now pinched closed. */
export function pinchedClosed(seen: Seen, values: GestureValues): boolean {
  return GESTURES.some((g) => {
    const v = values[g];
    return v !== null && v <= CLOSED && (seen.ranges[g]?.max ?? 0) >= WAS_OPEN;
  });
}

export interface OnboardingSignals {
  audioOn: boolean;
  stopped: boolean;
  seen: Seen;
  /** A hand was locked during this step. */
  locked: boolean;
  /** A hand was unlocked during this step. */
  unlocked: boolean;
  /** The assistant applied a mapping during the tour. */
  aiApplied: boolean;
}

/** How long a finished step stays up before the tour moves on, so the user can keep playing with the gesture. */
export function lingerSeconds(step: OnboardingStep): number {
  // Nothing to play with once the sound has stopped.
  return step.check?.kind === "stopped" ? 1 : 7;
}

export function stepDone(step: OnboardingStep, s: OnboardingSignals): boolean {
  const check = step.check;
  if (!check) return false;
  switch (check.kind) {
    case "playing":
      return s.audioOn && !s.stopped;
    case "sweep": {
      if (ONBOARDING_STEPS[s.seen.index] !== step) return false;
      const r = s.seen.ranges[check.gesture];
      return r !== undefined && r.min <= CLOSED && r.max >= OPEN;
    }
    case "locked":
      return s.locked;
    case "unlocked":
      return s.unlocked;
    case "ai-applied":
      return s.aiApplied;
    case "stopped":
      return s.stopped;
  }
}
