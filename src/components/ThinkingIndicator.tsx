"use client";

import { useEffect, useState } from "react";

export const THINKING_PHRASES = {
  ask: ["Thinking it through", "Listening to your rack", "Finding the right words", "Checking the controls"],
  map: ["Thinking about your sound", "Picking parameters", "Shaping the curve", "Checking safe ranges"],
  transcribe: ["Transcribing", "Catching every word", "Reading it back"],
} as const;

const STEP_MS = 500;

/**
 * Loading state: a status line that changes every half second with a highlight sweeping
 * across it left to right, followed by three dots bobbing in a wave.
 */
export function ThinkingIndicator({ phrases }: { phrases: readonly string[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const phrase = phrases[i % phrases.length];
  return (
    <p className="flex items-center gap-1.5 text-[13px]" role="status" aria-live="polite" aria-label={phrase}>
      <span key={phrase} className="shimmer-text phrase-in" aria-hidden>
        {phrase}
      </span>
      <span className="flex items-end gap-[3px] pb-0.5" aria-hidden>
        <span className="wave-dot" />
        <span className="wave-dot" />
        <span className="wave-dot" />
      </span>
    </p>
  );
}
