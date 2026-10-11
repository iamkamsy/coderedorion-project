"use client";

import { Fragment, useLayoutEffect, useState, type ReactNode } from "react";

/**
 * Starts a brand-new session every time this page becomes visible.
 *
 * With Cache Components, Next.js hides pages with React <Activity> on navigation instead
 * of unmounting them. Hiding runs effect cleanups (so the rack, camera and event batcher
 * are released) but keeps React state, which would leave a stale "audio on" UI with no
 * rack behind it. Bumping the key when the page is hidden discards that state, so a
 * returning visit mounts a fresh session with nothing carried over.
 */
export function SessionBoundary({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(0);

  useLayoutEffect(() => {
    return () => setSession((s) => s + 1);
  }, []);

  return <Fragment key={session}>{children}</Fragment>;
}
