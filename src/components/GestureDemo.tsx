"use client";

import { useEffect, useState } from "react";
import type { DemoKind } from "@/onboarding/steps";

type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";
/** Per finger: `lean` in degrees away from its rest direction, and `curl` from 0 (straight) to 1 (folded toward the viewer). */
type Pose = Record<Finger, { lean: number; curl: number }>;

const FINGERS: Finger[] = ["thumb", "index", "middle", "ring", "pinky"];
const WRIST = { x: 68, y: 108 };

/** A right hand as the mirrored camera shows it: palm to the viewer, thumb on the left. Angles are degrees from straight up. */
const SKELETON: Record<Finger, { base: { x: number; y: number }; angle: number; bones: number[]; bend: number }> = {
  thumb: { base: { x: 48, y: 90 }, angle: -52, bones: [17, 14, 11], bend: 1 },
  index: { base: { x: 53, y: 66 }, angle: -8, bones: [20, 13, 10], bend: -1 },
  middle: { base: { x: 66, y: 62 }, angle: 0, bones: [22, 14, 11], bend: -1 },
  ring: { base: { x: 78, y: 65 }, angle: 8, bones: [20, 13, 10], bend: -1 },
  pinky: { base: { x: 89, y: 72 }, angle: 18, bones: [15, 10, 8], bend: -1 },
};

const FOLDED = { lean: 0, curl: 0.9 };

const POSES = {
  pinchOpen: { thumb: { lean: -12, curl: 0 }, index: { lean: 4, curl: 0.05 }, middle: FOLDED, ring: FOLDED, pinky: FOLDED },
  pinchClosed: { thumb: { lean: 37, curl: 0.1 }, index: { lean: -30, curl: 0.95 }, middle: FOLDED, ring: FOLDED, pinky: FOLDED },
  pinchHalf: { thumb: { lean: 14, curl: 0.05 }, index: { lean: -14, curl: 0.5 }, middle: FOLDED, ring: FOLDED, pinky: FOLDED },
  pinkyOut: { thumb: { lean: 14, curl: 0.05 }, index: { lean: -14, curl: 0.5 }, middle: FOLDED, ring: FOLDED, pinky: { lean: 8, curl: 0 } },
  rock: { thumb: { lean: -12, curl: 0 }, index: { lean: 0, curl: 0 }, middle: FOLDED, ring: FOLDED, pinky: { lean: 8, curl: 0 } },
  relaxed: {
    thumb: { lean: 14, curl: 0.25 },
    index: { lean: 0, curl: 0.5 },
    middle: { lean: 0, curl: 0.55 },
    ring: { lean: 0, curl: 0.55 },
    pinky: { lean: 0, curl: 0.5 },
  },
  open: {
    thumb: { lean: -14, curl: 0 },
    index: { lean: -8, curl: 0 },
    middle: { lean: -1, curl: 0 },
    ring: { lean: 7, curl: 0 },
    pinky: { lean: 16, curl: 0 },
  },
} satisfies Record<string, Pose>;

/** Each demo swings from the first pose to the second and back. */
const DEMOS: Record<DemoKind, [Pose, Pose]> = {
  pinch: [POSES.pinchOpen, POSES.pinchClosed],
  pinky: [POSES.pinchHalf, POSES.pinkyOut],
  rock: [POSES.pinchHalf, POSES.rock],
  palm: [POSES.relaxed, POSES.open],
};

const PERIOD_MS = 2200;
const FORESHORTEN = 0.55;
const HOOK_DEGREES = 12;

function fingerPoints(finger: Finger, a: Pose, b: Pose, t: number) {
  const { base, angle, bones, bend } = SKELETON[finger];
  const lean = a[finger].lean + (b[finger].lean - a[finger].lean) * t;
  const curl = a[finger].curl + (b[finger].curl - a[finger].curl) * t;
  const points = [base];
  // Seen from the front, a folding finger mostly gets shorter, with a slight hook.
  const reach = 1 - FORESHORTEN * curl;
  let dir = angle + lean;
  for (const length of bones) {
    const prev = points[points.length - 1];
    const rad = (dir * Math.PI) / 180;
    points.push({ x: prev.x + Math.sin(rad) * length * reach, y: prev.y - Math.cos(rad) * length * reach });
    dir += bend * curl * HOOK_DEGREES;
  }
  return points;
}

/** A looping hand-skeleton animation of one gesture, drawn like the tracking overlay on the camera. */
export function GestureDemo({ kind, hand }: { kind: DemoKind; hand: "left" | "right" }) {
  // Starts (and, with reduced motion, stays) on the finished gesture.
  const [t, setT] = useState(1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      setT(0.5 + 0.5 * Math.cos(((now - start) / PERIOD_MS) * Math.PI * 2));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const [from, to] = DEMOS[kind];
  const fingers = FINGERS.map((f) => fingerPoints(f, from, to, t));
  const knuckles = fingers.map((f) => f[0]);
  const thumbTip = fingers[0][3];
  const indexTip = fingers[1][3];
  const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");

  return (
    <svg viewBox="0 0 120 120" className="size-24 shrink-0" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g transform={hand === "left" ? "translate(120 0) scale(-1 1)" : undefined}>
        <g stroke="rgb(255 255 255 / 0.7)" strokeWidth="2.5">
          <path d={path([WRIST, knuckles[0]])} />
          <path d={path([WRIST, ...knuckles.slice(1), WRIST])} />
          {fingers.map((f, i) => (
            <path key={FINGERS[i]} d={path(f)} />
          ))}
        </g>
        {(kind === "pinch" || kind === "pinky") && <path d={path([thumbTip, indexTip])} stroke="var(--accent)" strokeWidth="4" />}
        <g fill="#fff">
          <circle cx={WRIST.x} cy={WRIST.y} r="2.6" />
          {fingers.flat().map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.6" />
          ))}
        </g>
        {kind === "pinky" && <circle cx={fingers[4][3].x} cy={fingers[4][3].y} r={3 + 3 * t} stroke="var(--accent)" strokeWidth="2" />}
      </g>
    </svg>
  );
}
