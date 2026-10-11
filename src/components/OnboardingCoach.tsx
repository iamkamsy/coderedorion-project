"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Gesture } from "@/mapping/types";
import { ONBOARDING_STEPS, type Pointer } from "@/onboarding/steps";
import type { Onboarding } from "@/onboarding/useOnboarding";
import { isCoachVoiceOn, setCoachVoice, speak, stopSpeaking, useCoachVoice, useSpeaking } from "@/lib/speech";
import { GestureDemo } from "./GestureDemo";
import { SpeakerIcon } from "./TutorialCoach";

const POINTER_SIZE = 22;
const POINTER_GAP = 4;
const CARD =
  "rounded-2xl border border-white/15 bg-[rgb(18_18_20/0.9)] text-[#f5f5f7] shadow-[0_16px_40px_-12px_rgb(0_0_0/0.6)] backdrop-blur-2xl";

interface Props {
  tour: Onboarding;
  /** Which gesture drives each parameter right now, keyed "plugin.param". */
  bound: Map<string, Gesture>;
  /** The studio's root. Targets are looked up inside it. */
  rootRef: React.RefObject<HTMLElement | null>;
  onBegin: () => void;
  /** Leave the intro early. */
  onSkip: () => void;
  /** The last card's button. */
  onFinish: () => void;
}

/** The first-visit intro: a camera permission pop-up, then one card per step over the camera. */
export function OnboardingCoach({ tour, bound, rootRef, onBegin, onSkip, onFinish }: Props) {
  const voiceOn = useCoachVoice();
  const speaking = useSpeaking();
  const pointerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { step, index, done } = tour;
  const isLast = index === ONBOARDING_STEPS.length - 1;

  const spoken = step ? `${step.title}. ${step.body}` : null;
  useEffect(() => {
    if (!spoken || !voiceOn || !isCoachVoiceOn()) return;
    void speak(spoken);
  }, [spoken, voiceOn]);

  useEffect(() => stopSpeaking, []);

  // An arrow on each control this step is about, including the parameters the step's gesture drives right now.
  const pointers = useMemo<Pointer[]>(() => {
    if (!step) return [];
    const driven = [...bound]
      .filter(([, gesture]) => gesture === step.pointsAt)
      .map(([key]) => ({ target: `param-${key}`, side: "left" as const }));
    return [...step.pointers, ...driven];
  }, [step, bound]);

  // Keep each arrow beside its control, every frame, so it follows scrolling and panels opening.
  useEffect(() => {
    if (pointers.length === 0) return;
    let raf = 0;
    const els: (HTMLElement | null)[] = pointers.map(() => null);
    const last = pointers.map(() => "");
    const tick = () => {
      raf = requestAnimationFrame(tick);
      pointers.forEach((p, i) => {
        const arrow = pointerRefs.current[i];
        if (!arrow) return;
        const found = rootRef.current?.querySelector<HTMLElement>(`[data-tour="${p.target}"]`) ?? null;
        if (found !== els[i]) {
          els[i] = found;
          // The panel may have just opened with the control below its fold.
          found?.scrollIntoView({ block: "nearest" });
        }
        const rect = els[i]?.getBoundingClientRect();
        const clip = els[i]?.closest(".overflow-y-auto")?.getBoundingClientRect();
        const midY = rect ? rect.top + rect.height / 2 : 0;
        const hidden = !rect || (clip !== undefined && (midY < clip.top || midY > clip.bottom));
        const x = rect && (p.side === "left" ? rect.left - POINTER_SIZE - POINTER_GAP : rect.left + rect.width / 2 - POINTER_SIZE / 2);
        const y = rect && (p.side === "left" ? midY - POINTER_SIZE / 2 : rect.top - POINTER_SIZE - POINTER_GAP);
        const css = hidden ? "opacity:0" : `opacity:1;transform:translate3d(${x}px,${y}px,0)`;
        if (css !== last[i]) arrow.style.cssText = last[i] = css;
      });
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [pointers, rootRef]);

  if (tour.phase === "welcome") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
        <div role="dialog" aria-modal="true" aria-labelledby="welcome-title" className={`${CARD} w-full max-w-md p-6`}>
          <h2 id="welcome-title" className="text-xl font-semibold tracking-tight">
            Shape sound with your hands
          </h2>
          <p className="mt-2 text-sm leading-snug text-white/70">
            Gesture Rack follows your hands through the camera. A one-minute intro shows you each gesture, one at a time.
          </p>
          <div className="mt-4 flex gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">
            <svg
              viewBox="0 0 20 20"
              className="mt-0.5 size-4 shrink-0 text-[#ff8a9b]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <rect x="4" y="9" width="12" height="8" rx="2" />
              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" strokeLinecap="round" />
            </svg>
            <div className="text-sm leading-snug">
              <p className="font-medium">Your video never leaves this device</p>
              <p className="mt-1 text-white/70">
                The camera is only used to find your hands, right here in your browser. We never record, upload or store your face or any
                footage.
              </p>
              <p className="mt-2 text-xs text-white/50">
                The effect settings you move and what you ask the AI are saved for your dashboard, where you can turn sharing off.
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button type="button" onClick={onBegin} className="press rounded-xl bg-white px-5 py-2 text-sm font-semibold text-[#111]">
              Allow camera and begin
            </button>
            <button type="button" onClick={onSkip} className="press rounded-xl px-2 py-2 text-sm text-white/60 hover:text-white">
              Skip intro
            </button>
          </div>
          <p className="mt-3 text-xs text-white/50">Your browser will ask for camera permission. Headphones recommended.</p>
        </div>
      </div>
    );
  }

  if (!step) return null;
  return (
    <>
      {pointers.map((p, i) => (
        <div
          key={p.target}
          ref={(el) => {
            pointerRefs.current[i] = el;
          }}
          className="tour-pointer"
          data-side={p.side}
          aria-hidden
          style={{ opacity: 0 }}
        >
          <svg viewBox="0 0 22 22" width={POINTER_SIZE} height={POINTER_SIZE} fill="none" stroke="currentColor" strokeWidth="3.5">
            <path d="m7 4 8 7-8 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ))}
      <div
        role="dialog"
        aria-label={`Intro step ${index + 1} of ${ONBOARDING_STEPS.length}: ${step.title}`}
        className={`${CARD} fixed top-24 left-1/2 z-[45] flex w-[min(440px,calc(100vw-24px))] -translate-x-1/2 items-center gap-3 p-4`}
      >
        {step.demo && <GestureDemo key={step.id} kind={step.demo.kind} hand={step.demo.hand} />}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-[#ff8a9b] uppercase">
              Step {index + 1} of {ONBOARDING_STEPS.length}
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                role="switch"
                aria-checked={voiceOn}
                onClick={() => setCoachVoice(!voiceOn)}
                title={voiceOn ? "Voice coach on: steps are read aloud" : "Voice coach off"}
                aria-label="Read steps aloud"
                className={`press flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-xs ${voiceOn ? "text-white" : "text-white/50 hover:text-white"}`}
              >
                {voiceOn && speaking ? (
                  <span className="flex items-end gap-[2px]" aria-hidden>
                    <span className="wave-dot" />
                    <span className="wave-dot" />
                    <span className="wave-dot" />
                  </span>
                ) : (
                  <SpeakerIcon on={voiceOn} />
                )}
                Voice
              </button>
              {!isLast && (
                <button type="button" onClick={onSkip} className="press rounded-lg px-1.5 py-0.5 text-xs text-white/60 hover:text-white">
                  Skip intro
                </button>
              )}
            </span>
          </div>
          <p className="font-medium">{step.title}</p>
          <p className="mt-1 text-sm leading-snug text-white/70">{step.body}</p>
          {done && <p className="mt-2 text-sm font-medium text-[#ff8a9b]">{step.doneNote ?? "Nice, that's it. Keep playing with it."}</p>}
          <div className="mt-3 flex items-center gap-2">
            <div className="mr-auto flex gap-1" aria-hidden>
              {ONBOARDING_STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-1.5 w-3 rounded-full ${i < index ? "bg-white/70" : i === index ? "bg-accent" : "bg-white/15"}`}
                />
              ))}
            </div>
            {isLast ? (
              <button type="button" onClick={onFinish} className="press rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-[#111]">
                Start playing
              </button>
            ) : (
              <button
                type="button"
                onClick={tour.next}
                className={`press rounded-xl px-3 py-1.5 text-sm font-semibold ${done ? "bg-white text-[#111]" : "border border-white/20 text-white/70 hover:text-white"}`}
              >
                {!done ? "Skip" : tour.secondsLeft === null ? "Next" : `Next (${tour.secondsLeft})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
