import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { saveFinished } from "@/components/TutorialCoach";
import type { GestureValues } from "@/mapping/types";
import {
  INTRO_SLUG,
  ONBOARDING_STEPS,
  isRevealed,
  lingerSeconds,
  stepDone,
  widenSeen,
  type OnboardingStep,
  type Panel,
  type Seen,
} from "./steps";

const KEY = "gesture-rack.onboarded";
const listeners = new Set<() => void>();

function readOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    // Without storage the intro would return on every visit, so skip it.
    return true;
  }
}

function setOnboarded(value: boolean) {
  try {
    localStorage.setItem(KEY, String(value));
  } catch {}
  listeners.forEach((cb) => cb());
}

/** Queue the intro to run on the next visit to the studio. */
export function replayIntro() {
  setOnboarded(false);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

interface Options {
  /** False where the intro never runs (lesson playgrounds). */
  enabled: boolean;
  values: GestureValues;
  audioOn: boolean;
  stopped: boolean;
}

export interface Onboarding {
  /** "welcome" is the camera permission pop-up, "tour" the guided steps. */
  phase: "off" | "welcome" | "tour";
  index: number;
  /** The current step, while touring. */
  step: OnboardingStep | null;
  done: boolean;
  /** Seconds until the tour moves on by itself, while a finished step lingers. */
  secondsLeft: number | null;
  seen: Seen;
  /** Whether a side panel should be on screen. Always true outside the intro. */
  shows: (panel: Panel) => boolean;
  begin: () => void;
  next: () => void;
  /** Leave the intro. `completed` is false when the user skipped out early. */
  finish: (completed: boolean) => void;
  replay: () => void;
  /** A hand was locked (true) or unlocked (false) by gesture. */
  noteLock: (locked: boolean) => void;
  noteAiApplied: () => void;
}

/** First-visit intro: a camera-only screen that teaches the gestures, then opens each panel in turn. */
export function useOnboarding({ enabled, values, audioOn, stopped }: Options): Onboarding {
  const onboarded = useSyncExternalStore(subscribe, readOnboarded, () => true);
  const [begun, setBegun] = useState(false);
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState<Seen>({ index: 0, ranges: {} });
  // The step during which a hand was last locked, and last unlocked.
  const [lockAt, setLockAt] = useState<number | null>(null);
  const [unlockAt, setUnlockAt] = useState<number | null>(null);
  const [aiApplied, setAiApplied] = useState(false);
  const [countdown, setCountdown] = useState({ index: -1, left: 0 });

  const phase = !enabled || onboarded ? "off" : begun ? "tour" : "welcome";
  const step = phase === "tour" ? ONBOARDING_STEPS[index] : null;

  const widened = phase === "tour" ? widenSeen(seen, index, values) : seen;
  if (widened !== seen) setSeen(widened);

  const done =
    step !== null && stepDone(step, { audioOn, stopped, seen: widened, locked: lockAt === index, unlocked: unlockAt === index, aiApplied });
  const last = index === ONBOARDING_STEPS.length - 1;
  const waits = step?.doneNote !== undefined;

  // A finished step lingers so the user can keep playing, then the tour moves on. Pressing Next
  // changes the index, which ends this countdown, and the guard below keeps a late tick from skipping twice.
  const linger = step && done && !last && !waits ? lingerSeconds(step) : null;
  useEffect(() => {
    if (linger === null) return;
    let left = linger;
    const id = setInterval(() => {
      left -= 1;
      if (left > 0) return setCountdown({ index, left });
      clearInterval(id);
      setIndex((i) => (i === index ? i + 1 : i));
    }, 1000);
    return () => {
      clearInterval(id);
      setCountdown({ index: -1, left: 0 });
    };
  }, [linger, index]);
  const secondsLeft = linger === null ? null : countdown.index === index ? countdown.left : linger;

  // The camera loop keeps the callback it was started with, so noteLock must never change identity.
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  });

  const reset = () => {
    setBegun(false);
    setIndex(0);
    setLockAt(null);
    setUnlockAt(null);
    setAiApplied(false);
  };

  return {
    phase,
    index,
    step,
    done,
    secondsLeft,
    seen: widened,
    shows: (panel) => phase === "off" || (phase === "tour" && isRevealed(panel, index)),
    begin: () => setBegun(true),
    next: () => setIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1)),
    finish: (completed) => {
      if (completed) saveFinished(INTRO_SLUG);
      setOnboarded(true);
      reset();
    },
    replay: () => {
      reset();
      replayIntro();
    },
    noteLock: useCallback((locked: boolean) => (locked ? setLockAt : setUnlockAt)(indexRef.current), []),
    noteAiApplied: useCallback(() => setAiApplied(true), []),
  };
}
