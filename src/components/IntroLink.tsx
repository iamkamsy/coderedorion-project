"use client";

import Link from "next/link";
import { replayIntro } from "@/onboarding/useOnboarding";

/** Opens the studio with the intro tour queued up, whether or not this browser has seen it. */
export function IntroLink({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <Link href="/" onClick={replayIntro} className={className}>
      {children}
    </Link>
  );
}
