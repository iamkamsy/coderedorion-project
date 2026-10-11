import type { Metadata } from "next";
import Link from "next/link";
import { PLUGINS } from "@/audio/paramSchema";
import { LessonBadge } from "@/components/LessonBadge";
import { TUTORIALS } from "@/tutorials";

export const metadata: Metadata = {
  title: "Learn · Gesture Rack",
  description: "Bite-sized lessons on audio effects. Shape the sound with your hands.",
};

export default function LearnPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-accent-text">Learn</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Hear what effects really do</h1>
          <p className="mt-2 max-w-xl text-muted">
            Three-minute lessons. Each one loads a small rack with only the effects it teaches, so you can focus on one idea and shape it
            with your hands.
          </p>
        </div>
        <Link href="/" className="glass rounded-xl px-3.5 py-2 text-[13px] font-semibold">
          Free play
        </Link>
      </header>

      <ol className="grid gap-4 md:grid-cols-3">
        {TUTORIALS.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/learn/${t.slug}`}
              className="group glass flex h-full flex-col rounded-[var(--radius-panel)] p-5 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-muted">0{t.number}</span>
                <LessonBadge slug={t.slug} status={t.status} />
              </div>
              <h2 className="mt-3 text-lg font-semibold group-hover:text-accent-text">{t.title}</h2>
              <p className="mt-1 text-sm text-muted">{t.tagline}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {t.modules.map((m) => (
                  <span key={m} className="rounded-full bg-black/[0.06] px-2 py-0.5 text-xs text-muted">
                    {PLUGINS.find((p) => p.id === m)?.label ?? m}
                  </span>
                ))}
              </div>
              <span className="mt-auto pt-5 text-sm text-muted">
                {t.minutes} min · {t.steps.length} steps
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
