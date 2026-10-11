import { echoesInTime } from "./echoesInTime";
import { gritAndWarmth } from "./gritAndWarmth";
import { movement } from "./movement";
import { TutorialSchema, type Tutorial } from "./types";

/** All tutorials in order. Parsed once so a malformed data file fails loudly in dev and tests. */
export const TUTORIALS: readonly Tutorial[] = [echoesInTime, gritAndWarmth, movement].map((t) => TutorialSchema.parse(t));

export function getTutorial(slug: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.slug === slug);
}

export function nextTutorial(slug: string): Tutorial | undefined {
  const i = TUTORIALS.findIndex((t) => t.slug === slug);
  return i >= 0 ? TUTORIALS[i + 1] : undefined;
}

export type { Check, Preset, Step, Tutorial } from "./types";
