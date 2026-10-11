"use client";

import { useId, useState } from "react";

interface Props {
  title: string;
  /** Extra info shown next to the title, such as a "2 live" badge. */
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  /** "section" for a top-level box, "item" for a dropdown nested inside one. */
  level?: "section" | "item";
  children: React.ReactNode;
}

const STYLES = {
  section: {
    wrapper: "",
    summary: "px-3.5 py-2.5 text-xs font-semibold tracking-wide uppercase",
    body: "px-3 pb-3",
  },
  item: {
    wrapper: "border-t border-border first:border-t-0",
    summary: "py-1.5 text-[13px] font-medium",
    body: "pb-2.5",
  },
};

/** A dropdown that slides open and closed. Animates the grid row from 0fr to 1fr, which works in every browser. */
export function Collapsible({ title, badge, defaultOpen = false, level = "section", children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const s = STYLES[level];
  return (
    <div className={s.wrapper}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 text-left text-muted select-none hover:text-text ${s.summary}`}
      >
        <span className="flex items-center gap-2">
          {level === "section" && <span className="size-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--accent)]" aria-hidden />}
          {title}
          {badge}
        </span>
        <svg
          viewBox="0 0 20 20"
          className={`size-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        id={bodyId}
        className={`grid transition-[grid-template-rows] duration-250 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className={s.body}>{children}</div>
        </div>
      </div>
    </div>
  );
}
