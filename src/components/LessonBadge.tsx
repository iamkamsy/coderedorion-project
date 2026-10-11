"use client";

import { useSyncExternalStore } from "react";
import { readFinished } from "./TutorialCoach";

const noop = () => () => {};

export function LessonBadge({ slug, status }: { slug: string; status: "ready" | "preview" }) {
  const finished = useSyncExternalStore(
    noop,
    () => readFinished(slug),
    () => false,
  );
  if (finished) return <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-on-ink">Done ✓</span>;
  if (status === "preview") return <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-xs text-muted">Preview</span>;
  return <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-text">Start here</span>;
}
