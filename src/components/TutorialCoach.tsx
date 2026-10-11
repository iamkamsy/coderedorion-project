"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { checkPasses, type CoachSignals } from "@/tutorials/checks";
import { nextTutorial, type Tutorial } from "@/tutorials";
import { placeCard, visibleRect, type Side } from "@/tutorials/placement";
import { isCoachVoiceOn, setCoachVoice, speak, stopSpeaking, useCoachVoice, useSpeaking } from "@/lib/speech";

const CARD_WIDTH = 320;
const GAP = 12;
const ADVANCE_DELAY_MS = 900;

interface Props {
  tutorial: Tutorial;
  signals: CoachSignals;
  /** This playground's root. Targets are looked up inside it, never in a hidden page. */
  rootRef: React.RefObject<HTMLElement | null>;
}

function progressKey(slug: string) {
  return `gesture-rack.tutorial.${slug}`;
}

/** Records that a tutorial was finished, for the badge on /learn. */
function saveFinished(slug: string) {
  try {
    localStorage.setItem(progressKey(slug), JSON.stringify({ finished: true, at: new Date().toISOString() }));
  } catch {}
}

export function readFinished(slug: string): boolean {
  try {
    return JSON.parse(localStorage.getItem(progressKey(slug)) ?? "{}").finished === true;
  } catch {
    return false;
  }
}

/**
 * Step-by-step pop-up anchored to the control it talks about (`data-tour` ids).
 * A step with a check completes on its own; every step can be skipped.
 */
export function TutorialCoach({ tutorial, signals, rootRef }: Props) {
  const [index, setIndex] = useState(0);
  // Whether the step was already satisfied when the user arrived (for example after Back).
  // Those steps wait for Next instead of skipping ahead on their own.
  const [doneOnArrival, setDoneOnArrival] = useState(() => checkPasses(tutorial.steps[0].check, signals));
  const [hidden, setHidden] = useState(false);
  const voiceOn = useCoachVoice();
  const speaking = useSpeaking();
  const cardRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const step = tutorial.steps[index];
  const isLast = index === tutorial.steps.length - 1;
  const done = checkPasses(step.check, signals);
  const next = nextTutorial(tutorial.slug);

  const goTo = (i: number) => {
    const target = Math.min(Math.max(i, 0), tutorial.steps.length - 1);
    setIndex(target);
    setDoneOnArrival(checkPasses(tutorial.steps[target].check, signals));
  };
  const goToRef = useRef(goTo);
  useEffect(() => {
    goToRef.current = goTo;
  });

  // Auto-advance shortly after the user completes the step, so they see the confirmation.
  useEffect(() => {
    if (!done || doneOnArrival || isLast) return;
    const id = setTimeout(() => goToRef.current(index + 1), ADVANCE_DELAY_MS);
    return () => clearTimeout(id);
  }, [done, doneOnArrival, isLast, index]);

  useEffect(() => {
    if (isLast) saveFinished(tutorial.slug);
  }, [isLast, tutorial.slug]);

  // Follow the target with a spotlight ring and keep the card beside it. Both are fixed at
  // the page root, so scroll columns and collapsible panels can't clip them, and both are
  // positioned with transforms on every animation frame (no React state, no layout jumps).
  useEffect(() => {
    const card = cardRef.current;
    const ring = ringRef.current;
    if (hidden || !card || !ring) return;
    let raf = 0;
    let frame = 0;
    let el: HTMLElement | null = null;
    let clips: HTMLElement[] = [];
    let side: Side = "below";
    let lastCard = "";
    let lastRing = "";

    const write = (node: HTMLElement, css: string, last: string) => {
      if (css !== last) node.style.cssText = css;
      return css;
    };
    const dock = () => {
      lastRing = write(ring, "opacity:0", lastRing);
      const x = window.innerWidth - card.offsetWidth - GAP;
      const y = window.innerHeight - card.offsetHeight - GAP;
      lastCard = write(card, `width:${CARD_WIDTH}px;transform:translate3d(${x}px,${y}px,0)`, lastCard);
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      // Re-find the target now and then: it may mount later (after audio starts) or re-render.
      if (step.target && (!el?.isConnected || frame++ % 30 === 0)) {
        const found = rootRef.current?.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) ?? null;
        if (found !== el) {
          el = found;
          clips = el ? clippingAncestors(el) : [];
          el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
      if (!el) return dock();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const vis = visibleRect(
        el.getBoundingClientRect(),
        clips.map((c) => c.getBoundingClientRect()),
        viewport,
      );
      if (!vis) return dock();

      const pad = 4;
      lastRing = write(
        ring,
        `opacity:1;transform:translate3d(${vis.left - pad}px,${vis.top - pad}px,0);width:${vis.right - vis.left + pad * 2}px;height:${vis.bottom - vis.top + pad * 2}px`,
        lastRing,
      );
      const placed = placeCard(vis, { width: CARD_WIDTH, height: card.offsetHeight }, viewport, side, GAP);
      side = placed.side;
      lastCard = write(
        card,
        `width:${CARD_WIDTH}px;transform:translate3d(${Math.round(placed.left)}px,${Math.round(placed.top)}px,0)`,
        lastCard,
      );
    };

    tick();
    return () => cancelAnimationFrame(raf);
  }, [hidden, step.target, index, rootRef]);

  // Read each step aloud while the voice is on. The toggle is shared by every card, so it
  // carries over from step to step and lesson to lesson.
  const spoken = isLast ? `${step.title}. ${step.body} ${tutorial.recap.join(" ")}` : `${step.title}. ${step.body}`;
  useEffect(() => {
    if (hidden || !voiceOn || !isCoachVoiceOn()) return;
    void speak(spoken);
  }, [hidden, voiceOn, spoken]);

  useEffect(() => stopSpeaking, []);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="press fixed right-4 bottom-4 z-40 rounded-full border border-white/15 bg-[rgb(18_18_20/0.88)] px-4 py-2 text-sm font-medium text-[#f5f5f7] shadow-[0_16px_40px_-12px_rgb(0_0_0/0.6)] backdrop-blur-2xl"
      >
        Show lesson ({index + 1}/{tutorial.steps.length})
      </button>
    );
  }

  return (
    <>
      <div ref={ringRef} className="coach-ring" aria-hidden style={{ opacity: 0 }} />
      <div
        ref={cardRef}
        role="dialog"
        aria-label={`Lesson step ${index + 1} of ${tutorial.steps.length}: ${step.title}`}
        className="coach-card max-w-[calc(100vw-24px)] rounded-2xl border border-white/15 bg-[rgb(18_18_20/0.9)] p-4 text-[#f5f5f7] shadow-[0_16px_40px_-12px_rgb(0_0_0/0.6)] backdrop-blur-2xl"
        style={{ width: CARD_WIDTH }}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-[#ff8a9b] uppercase">
            Step {index + 1} of {tutorial.steps.length}
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
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                setHidden(true);
              }}
              className="press rounded-lg px-1.5 py-0.5 text-xs text-white/60 hover:text-white"
              aria-label="Hide lesson"
            >
              Hide
            </button>
          </span>
        </div>
        <p className="font-medium">{step.title}</p>
        <p className="mt-1 text-sm leading-snug text-white/70">{step.body}</p>

        {isLast && (
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {tutorial.recap.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-[#ff8a9b]">✓</span>
                {r}
              </li>
            ))}
          </ul>
        )}

        {done && !isLast && <p className="mt-2 text-sm font-medium text-[#ff8a9b]">Nice, that&apos;s it.</p>}

        <div className="mt-3 flex items-center gap-2">
          <div className="mr-auto flex gap-1" aria-hidden>
            {tutorial.steps.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 w-4 rounded-full ${i < index ? "bg-white/70" : i === index ? "bg-accent" : "bg-white/15"}`}
              />
            ))}
          </div>
          {index > 0 && (
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              className="press rounded-xl px-2 py-1 text-sm text-white/60 hover:text-white"
            >
              Back
            </button>
          )}
          {isLast ? (
            next ? (
              <Link href={`/learn/${next.slug}`} className="press rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-[#111]">
                Next: {next.title}
              </Link>
            ) : (
              <Link href="/learn" className="press rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-[#111]">
                All lessons
              </Link>
            )
          ) : (
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              className={`press rounded-xl px-3 py-1.5 text-sm font-semibold ${done || !step.check ? "bg-white text-[#111]" : "border border-white/20 text-white/70 hover:text-white"}`}
            >
              {done || !step.check ? "Next" : "Skip"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/** Ancestors that clip their content (scroll columns, collapsible panels). */
function clippingAncestors(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(p);
    if (/(auto|scroll|hidden|clip)/.test(overflowX + overflowY)) out.push(p);
  }
  return out;
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3.5 8h3l4-3.5v11L6.5 12h-3Z" strokeLinejoin="round" />
      {on ? (
        <path d="M13.5 7.5a3.5 3.5 0 0 1 0 5M15.5 5.5a6.5 6.5 0 0 1 0 9" strokeLinecap="round" />
      ) : (
        <path d="m13.5 8 4 4m0-4-4 4" strokeLinecap="round" />
      )}
    </svg>
  );
}
