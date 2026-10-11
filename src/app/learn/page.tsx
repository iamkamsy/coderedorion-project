import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { PLUGINS } from "@/audio/paramSchema";
import { HomeButton } from "@/components/HomeButton";
import { IntroLink } from "@/components/IntroLink";
import { LessonBadge } from "@/components/LessonBadge";
import { PinchGlyph } from "@/components/PinchGlyph";
import { INTRO_SLUG, ONBOARDING_STEPS } from "@/onboarding/steps";
import { TUTORIALS } from "@/tutorials";

export const metadata: Metadata = {
  title: "Learn · Gesture Labs",
  description: "Bite-sized lessons on audio effects. Shape the sound with your hands.",
};

function EffectIcon({ id, className }: { id: string; className: string }) {
  return <span className={`effect-icon ${className}`} style={{ "--icon": `url(/icons/effects/${id}.svg)` } as CSSProperties} aria-hidden />;
}

const CARD =
  "group glass flex flex-col gap-4 rounded-[var(--radius-panel)] p-5 transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-5";
const CHIP = "flex items-center gap-1.5 rounded-full bg-black/[0.06] px-2 py-0.5 text-xs text-muted";
const INTRO_TOPICS = ["Gestures", "Effects rack", "Spectrum", "AI assistant"];

interface CardProps {
  number: number;
  title: string;
  tagline: string;
  chips: React.ReactNode;
  slug: string;
  status: "ready" | "preview";
  meta: string;
  /** Icon tiles on the card's right edge. */
  icons: React.ReactNode;
}

function CardBody({ number, title, tagline, chips, slug, status, meta, icons }: CardProps) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-muted">0{number}</span>
          <h2 className="text-lg font-semibold group-hover:text-accent-text">{title}</h2>
        </div>
        <p className="mt-1 text-sm text-muted">{tagline}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{chips}</div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end">
        <LessonBadge slug={slug} status={status} />
        <span className="text-sm text-muted">{meta}</span>
      </div>
      <div className="flex shrink-0 gap-2">{icons}</div>
    </>
  );
}

export default function LearnPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6">
      <nav className="glass flex items-center justify-between rounded-2xl p-2 pl-2.5" aria-label="Main">
        <HomeButton />
        <Link href="/dashboard" className="press rounded-xl px-3 py-1.5 text-[13px] text-muted hover:text-text">
          Dashboard
        </Link>
      </nav>
      <header>
        <div>
          <p className="text-sm font-semibold text-accent-text">Learn</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Hear what effects really do</h1>
          <p className="mt-2 max-w-xl text-muted">
            Three-minute lessons. Each one loads a small rack with only the effects it teaches, so you can focus on one idea and shape it
            with your hands.
          </p>
        </div>
      </header>

      <ol className="grid gap-4">
        <li>
          <IntroLink className={CARD}>
            <CardBody
              number={0}
              title="Meet Gesture Rack"
              tagline="Learn the hand gestures and find your way around the studio."
              chips={INTRO_TOPICS.map((topic) => (
                <span key={topic} className={CHIP}>
                  {topic}
                </span>
              ))}
              slug={INTRO_SLUG}
              status="ready"
              meta={`2 min · ${ONBOARDING_STEPS.length} steps`}
              icons={
                <span className="flex size-14 items-center justify-center rounded-2xl bg-ink [&>svg]:size-8">
                  <PinchGlyph />
                </span>
              }
            />
          </IntroLink>
        </li>
        {TUTORIALS.map((t) => (
          <li key={t.slug}>
            <Link href={`/learn/${t.slug}`} className={CARD}>
              <CardBody
                number={t.number}
                title={t.title}
                tagline={t.tagline}
                chips={t.modules.map((m) => (
                  <span key={m} className={CHIP}>
                    <EffectIcon id={m} className="size-3" />
                    {PLUGINS.find((p) => p.id === m)?.label ?? m}
                  </span>
                ))}
                slug={t.slug}
                status={t.status}
                meta={`${t.minutes} min · ${t.steps.length} steps`}
                icons={t.modules.map((m) => (
                  <span key={m} className="flex size-14 items-center justify-center rounded-2xl bg-black/[0.06]">
                    <EffectIcon id={m} className="size-8" />
                  </span>
                ))}
              />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
