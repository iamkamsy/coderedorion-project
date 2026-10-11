"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { checkPasses, type CoachSignals } from "@/tutorials/checks";
import { nextTutorial, type Tutorial } from "@/tutorials";

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
  const cardRef = useRef<HTMLDivElement>(null);
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

  // Highlight the target and keep the card next to it as the layout moves. Positions the
  // card directly on its DOM node (no React state), and looks the target up on every tick
  // so controls that appear later, such as after audio starts, are found.
  useEffect(() => {
    const card = cardRef.current;
    if (hidden || !card) return;
    let highlighted: HTMLElement | null = null;
    let scrolled = false;

    const dock = () => {
      Object.assign(card.style, { top: "", left: "", right: `${GAP}px`, bottom: `${GAP}px` });
    };
    const place = () => {
      const el = step.target ? (rootRef.current?.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) ?? null) : null;
      if (el !== highlighted) {
        highlighted?.removeAttribute("data-tour-active");
        el?.setAttribute("data-tour-active", "");
        highlighted = el;
      }
      const r = el?.getBoundingClientRect();
      if (!el || !r || r.width === 0) return dock();
      if (!scrolled) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        scrolled = true;
      }
      const cardH = card.offsetHeight;
      const below = r.bottom + GAP + cardH <= window.innerHeight || r.top - GAP - cardH < 0;
      const top = Math.max(GAP, below ? r.bottom + GAP : r.top - GAP - cardH);
      const left = Math.min(Math.max(GAP, r.left + r.width / 2 - CARD_WIDTH / 2), window.innerWidth - CARD_WIDTH - GAP);
      Object.assign(card.style, { top: `${top}px`, left: `${left}px`, right: "", bottom: "" });
    };

    place();
    const id = setInterval(place, 250);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      highlighted?.removeAttribute("data-tour-active");
      clearInterval(id);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [hidden, step.target, index, rootRef]);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="fixed right-4 bottom-4 z-40 rounded-full border border-white/15 bg-[rgb(18_18_20/0.88)] px-4 py-2 text-sm font-medium text-[#f5f5f7] shadow-[0_16px_40px_-12px_rgb(0_0_0/0.6)] backdrop-blur-2xl"
      >
        Show lesson ({index + 1}/{tutorial.steps.length})
      </button>
    );
  }

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`Lesson step ${index + 1} of ${tutorial.steps.length}: ${step.title}`}
      className="fixed z-40 max-w-[calc(100vw-24px)] rounded-2xl border border-white/15 bg-[rgb(18_18_20/0.9)] p-4 text-[#f5f5f7] shadow-[0_16px_40px_-12px_rgb(0_0_0/0.6)] backdrop-blur-2xl"
      style={{ width: CARD_WIDTH, right: GAP, bottom: GAP }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-[#ff8a9b] uppercase">
          Step {index + 1} of {tutorial.steps.length}
        </span>
        <button type="button" onClick={() => setHidden(true)} className="text-xs text-white/60 hover:text-white" aria-label="Hide lesson">
          Hide
        </button>
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
          <button type="button" onClick={() => goTo(index - 1)} className="rounded-xl px-2 py-1 text-sm text-white/60 hover:text-white">
            Back
          </button>
        )}
        {isLast ? (
          next ? (
            <Link href={`/learn/${next.slug}`} className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-[#111]">
              Next: {next.title}
            </Link>
          ) : (
            <Link href="/learn" className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-[#111]">
              All lessons
            </Link>
          )
        ) : (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${done || !step.check ? "bg-white text-[#111]" : "border border-white/20 text-white/70 hover:text-white"}`}
          >
            {done || !step.check ? "Next" : "Skip"}
          </button>
        )}
      </div>
    </div>
  );
}
