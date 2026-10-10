"use client";

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
    group: "group/section",
    summary: "px-4 py-3 text-sm font-semibold tracking-wide uppercase",
    chevron: "group-open/section:rotate-180",
    body: "px-4 pb-4",
  },
  item: {
    group: "group/item border-t border-border first:border-t-0",
    summary: "py-2 text-sm font-medium",
    chevron: "group-open/item:rotate-180",
    body: "pb-3",
  },
};

export function Collapsible({ title, badge, defaultOpen = false, level = "section", children }: Props) {
  const s = STYLES[level];
  return (
    <details open={defaultOpen} className={s.group}>
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-2 text-muted select-none hover:text-text [&::-webkit-details-marker]:hidden ${s.summary}`}
      >
        <span className="flex items-center gap-2">
          {title}
          {badge}
        </span>
        <svg
          viewBox="0 0 20 20"
          className={`size-4 shrink-0 transition-transform ${s.chevron}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className={s.body}>{children}</div>
    </details>
  );
}
