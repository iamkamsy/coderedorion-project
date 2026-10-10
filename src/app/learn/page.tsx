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
          <p className="text-sm font-medium text-accent">Learn</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Hear what effects really do</h1>
          <p className="mt-2 max-w-xl text-muted">
            Three-minute lessons. Each one loads a small rack with only the effects it teaches, so you can focus on one idea and shape it
            with your hands.
          </p>
        </div>
        <Link href="/" className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-text">
          Free play
        </Link>
      </header>

      <ol className="grid gap-4 md:grid-cols-3">
        {TUTORIALS.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/learn/${t.slug}`}
              className="group flex h-full flex-col rounded-[var(--radius-panel)] border border-border bg-panel p-5 transition-colors hover:border-accent/60"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-muted">0{t.number}</span>
                <LessonBadge slug={t.slug} status={t.status} />
              </div>
              <h2 className="mt-3 text-lg font-semibold group-hover:text-accent">{t.title}</h2>
              <p className="mt-1 text-sm text-muted">{t.tagline}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {t.modules.map((m) => (
                  <span key={m} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
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
